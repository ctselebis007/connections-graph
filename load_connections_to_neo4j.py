#!/usr/bin/env python3
"""
Script to load Connections.json data into Neo4j database.
Uses lazy loading with ijson to handle large files without loading into memory.
"""

from html import parser
import json
import sys
from collections import defaultdict
from typing import Dict, List, Set

try:
    from neo4j import GraphDatabase
except ImportError as e:
    print(f"Neo4j driver not found: {e}")
    print("Please install neo4j: python -m pip install neo4j")
    sys.exit(1)

try:
    import ijson
except ImportError as e:
    print(f"ijson not found: {e}")
    print("Please install ijson: python -m pip install ijson")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError as e:
    print(f"tqdm not found: {e}")
    print("Please install tqdm: python -m pip install tqdm")
    sys.exit(1)


class Neo4jConnectionLoader:
    def __init__(self, uri: str = "bolt://localhost:7687", 
                 user: str = "neo4j", password: str = "KnowledgeNeo4j"):
        """Initialize Neo4j connection."""
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.node_data: Dict[str, Dict] = defaultdict(lambda: {
            "channel_ids": set(),
            "language_ids": set(),
            "document_names": set(),
            "collection_ids": set()
        })
        self.relationships: List[Dict] = []
        self.batch_size = 5000

    def close(self):
        """Close Neo4j connection."""
        self.driver.close()

    def clear_database(self):
        """Clear all nodes and relationships from the database."""
        with self.driver.session() as session:
            # Get current stats before clearing
            stats_before = self.get_stats()
            print(f"Current database state: {stats_before}")
            
            if stats_before['nodes'] == 0 and stats_before['relationships'] == 0:
                print("Database is already empty. Skipping clear operation.")
                return
            
            # Drop constraints first (required for node deletion)
            print("Dropping constraints...")
            try:
                session.run("DROP CONSTRAINT external_id IF EXISTS")
            except Exception as e:
                print(f"  Warning: Error dropping constraint (may not exist): {e}")
            
            # Clear all nodes and relationships
            print("Clearing all nodes and relationships...")
            session.run("""
                MATCH (n)
                DETACH DELETE n
            """)
            
            # Verify the database is cleared
            stats_after = self.get_stats()
            print(f"Database cleared. New state: {stats_after}")
            
            if stats_after['nodes'] == 0 and stats_after['relationships'] == 0:
                print("Database successfully cleared.")
            else:
                print("Warning: Database may not be completely cleared.")

    def create_indexes(self):
        """Create indexes for fast querying."""
        with self.driver.session() as session:
            # Create constraint/create index on node ExternalID
            session.run("""
                CREATE CONSTRAINT external_id IF NOT EXISTS 
                FOR (n:Node) REQUIRE n.ExternalID IS UNIQUE
            """)
            
            # Create index on channel_ids for filtering
            session.run("""
                CREATE INDEX node_channel IF NOT EXISTS 
                FOR (n:Node) ON (n.channel_ids)
            """)
            
            # Create index on language_ids for filtering
            session.run("""
                CREATE INDEX node_language IF NOT EXISTS 
                FOR (n:Node) ON (n.language_ids)
            """)
            
            # Create index on relationship LinkType
            session.run("""
                CREATE INDEX relationship_type IF NOT EXISTS 
                FOR ()-[r:CONNECTED]-() ON (r.LinkType)
            """)
            
            print("Indexes created successfully.")

    def process_json_lazy(self, file_path: str):
        """Process JSON file using lazy loading with progress bar."""
        print(f"Processing {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            # Use ijson.items to stream parse the JSON array
            connections = ijson.items(f, 'item')
            
            # Create progress bars
            record_progress = tqdm(desc="Processing records", unit="records", 
                                   mininterval=0.5, disable=False)
            batch_progress = tqdm(desc="Loading to Neo4j", unit="batches",
                                  mininterval=0.5, disable=False)
            
            try:
                for record in connections:
                    self._process_record(record)
                    record_progress.update(1)
                    
                    # Process in batches
                    if len(self.relationships) >= self.batch_size:
                        self._batch_create_nodes_and_relationships(batch_progress)
                        node_data_to_clear = set()
                        for rel in self.relationships:
                            node_data_to_clear.add(rel['source_id'])
                            node_data_to_clear.add(rel['target_id'])
                        for node_id in node_data_to_clear:
                            self.node_data.pop(node_id, None)
                        self.relationships.clear()
                        batch_progress.update(1)
                
                # Create final batch if there are remaining items
                if self.relationships:
                    self._batch_create_nodes_and_relationships(batch_progress)
                    batch_progress.update(1)
                
            finally:
                record_progress.close()
                batch_progress.close()
                
            print(f"\nProcessed {record_progress.n} total records")
            print(f"Completed {batch_progress.n} batches")

    def _process_record(self, record: Dict):
        """Process a single connection record."""
        source_id = record.get('SourceExternalID')
        target_id = record.get('TargetExternalID')
        link_type = record.get('LinkTypeName', 'Unknown')
        document_name = record.get('DocumentName', '')
        channel_id = record.get('ChannelID')
        language_id = record.get('LanguageID')
        collection_id = record.get('CollectionID', '')
        
        if source_id is None:
            return
            
        # Collect node data for source
        self.node_data[source_id]["channel_ids"].add(str(channel_id) if channel_id else '')
        self.node_data[source_id]["language_ids"].add(str(language_id) if language_id else '')
        if document_name:
            self.node_data[source_id]["document_names"].add(document_name)
        if collection_id:
            self.node_data[source_id]["collection_ids"].add(collection_id)
        
        # Store relationship (skip if target_id is null)
        if target_id is not None:
            # Also collect node data for target
            self.node_data[target_id]["channel_ids"].add(str(channel_id) if channel_id else '')
            self.node_data[target_id]["language_ids"].add(str(language_id) if language_id else '')
            if document_name:
                self.node_data[target_id]["document_names"].add(document_name)
            if collection_id:
                self.node_data[target_id]["collection_ids"].add(collection_id)
            
            self.relationships.append({
                'source_id': source_id,
                'target_id': target_id,
                'link_type': link_type
            })

    def _batch_create_nodes_and_relationships(self, progress_bar=None):
        """Create nodes and relationships in batch."""
        if progress_bar is not None:
            progress_bar.set_postfix(Nodes=len(self.node_data), Rels=len(self.relationships))
        
        with self.driver.session() as session:
            # Create nodes using UNWIND
            nodes_data = [
                {
                    'external_id': node_id,
                    'channel_ids': list(data['channel_ids']),
                    'language_ids': list(data['language_ids']),
                    'document_names': list(data['document_names']),
                    'collection_ids': list(data['collection_ids']),
                }
                for node_id, data in self.node_data.items()
            ]
            
            if nodes_data:
                session.run("""
                    UNWIND $nodes AS node
                    MERGE (n:Node {ExternalID: node.external_id})
                    SET n.channel_ids = node.channel_ids,
                        n.language_ids = node.language_ids,
                        n.document_names = node.document_names,
                        n.collection_ids = node.collection_ids
                """, nodes=nodes_data)
            
            # Create relationships
            if self.relationships:
                session.run("""
                    UNWIND $rels AS rel
                    MATCH (source:Node {ExternalID: rel.source_id})
                    MATCH (target:Node {ExternalID: rel.target_id})
                    MERGE (source)-[r:CONNECTED {LinkType: rel.link_type}]->(target)
                """, rels=self.relationships)

    def get_stats(self) -> Dict:
        """Get database statistics."""
        with self.driver.session() as session:
            node_count = session.run("MATCH (n:Node) RETURN count(n) AS count").single()['count']
            relationship_count = session.run("MATCH ()-[r:CONNECTED]->() RETURN count(r) AS count").single()['count']
            return {
                'nodes': node_count,
                'relationships': relationship_count
            }

    def update_nodes_from_json(self, file_path: str, batch_size: int = 1000):
        """
        Update all nodes by reading entire JSON file and then updating in batches.
        Reads nodes lazily, stores in dictionary, then updates database once all data is collected.
        
        Args:
            file_path: Path to Connections.json file
            batch_size: Number of nodes to update per batch
        """
        print("Starting bulk node update...")
        
        # Initialize fresh node data structure for updates
        update_data: Dict[str, Dict] = defaultdict(lambda: {
            "channel_ids": set(),
            "language_ids": set(),
            "document_names": set(),
            "collection_ids": set()
        })
        
        # Create progress bar for reading
        record_progress = tqdm(desc="Reading JSON records", unit="records", 
                               mininterval=0.5, disable=False)
        
        try:
            # Read entire JSON file lazily and collect all node metadata
            with open(file_path, 'r', encoding='utf-8') as f:
                connections = ijson.items(f, 'item')
                
                for record in connections:
                    self._collect_node_metadata_for_update(record, update_data)
                    record_progress.update(1)
            
            record_progress.close()
            print(f"\nCollected metadata for {len(update_data)} unique nodes")
            
            # Update database in batches
            self._update_database_in_batches(update_data, batch_size)
            
        except Exception as e:
            print(f"Error during node update: {e}")
            raise
    
    def _add_node_metadata(self, update_data: Dict, node_id: str, channel_id, language_id, document_name, collection_id):
        """
        Add metadata for a node to the update data dictionary.
        
        Args:
            update_data: Dictionary to accumulate node metadata
            node_id: External ID of the node
            channel_id: Channel ID to add
            language_id: Language ID to add
            document_name: Document name to add
            collection_id: Collection ID to add
        """
        update_data[node_id]["channel_ids"].add(str(channel_id) if channel_id else '')
        update_data[node_id]["language_ids"].add(str(language_id) if language_id else '')
        if document_name:
            update_data[node_id]["document_names"].add(document_name)
        if collection_id:
            update_data[node_id]["collection_ids"].add(collection_id)
    
    def _collect_node_metadata_for_update(self, record: Dict, update_data: Dict):
        """
        Collect metadata for nodes from a single connection record.
        Updates the the used to track all properties for each node.
        """
        source_id = record.get('SourceExternalID')
        target_id = record.get('TargetExternalID')
        
        if source_id is None:
            return
            
        # Extract metadata fields
        document_name = record.get('DocumentName', '')
        channel_id = record.get('ChannelID')
        language_id = record.get('LanguageID')
        collection_id = record.get('CollectionID', '')
        
        # Update source node metadata
        self._add_node_metadata(update_data, source_id, 
                              channel_id, language_id, document_name, 
                              collection_id)
        
        # Update target node metadata if exists
        if target_id is not None:
            self._add_node_metadata(update_data, target_id,
                              channel_id, language_id, document_name,
                              collection_id)
    
    def _determine_object_type(self, record: Dict) -> str:
        """
        Determine object type based on record content.
        This can be customized based on business requirements.
        """
        # Extract relevant fields to determine object type
        link_type = record.get('LinkTypeName', '')
        document_title = record.get('DocumentTitle', '')
        node_path = record.get('NodePath', '')
        collection_id = record.get('CollectionID', '')
        
        # Determine object type based on business logic
        # This is a sample implementation - adjust as needed
        if document_title:
            return "Document"
        elif collection_id and collection_id.startswith('C_'):
            return "Collection"
        elif node_path:
            return "Folder"
        elif link_type:
            return f"LinkType_{link_type}"
        else:
            return "Generic"
    
    def _update_database_in_batches(self, update_data: Dict, batch_size: int):
        """
        Update all nodes in database using collected metadata, in batches.
        
        Args:
            update_data: Dictionary with all node metadata
            batch_size: Number of nodes to update per batch
        """
        update_progress = tqdm(desc="Updating Neo4j nodes", unit="nodes", 
                               mininterval=0.5, disable=False,
                               total=len(update_data))
        
        try:
            # Process nodes in batches
            node_ids = list(update_data.keys())
            
            for i in range(0, len(node_ids), batch_size):
                batch_node_ids = node_ids[i:i + batch_size]
                self._update_nodes_batch(update_data, batch_node_ids)
                update_progress.update(len(batch_node_ids))
            
            update_progress.close()
            print(f"Updated {update_progress.n} nodes successfully")
            
        except Exception as e:
            print(f"Error during database update: {e}")
            update_progress.close()
            raise
    
    def _update_nodes_batch(self, update_data: Dict, node_ids: List[str]):
        """
        Update a batch of nodes in the database.
        
        Args:
            update_data: Dictionary with all node metadata
            node_ids: List of node ExternalIDs to update
        """
        with self.driver.session() as session:
            try:
                # Prepare batch data
                batch_nodes = []
                for node_id in node_ids:
                    data = update_data[node_id]
                    batch_nodes.append({
                        'external_id': node_id,
                        'channel_ids': list(data['channel_ids']),
                        'language_ids': list(data['language_ids']),
                        'document_names': list(data['document_names']),
                        'collection_ids': list(data['collection_ids']),
                    })
                
                if batch_nodes:
                    session.run("""
                        UNWIND $nodes AS node
                        MATCH (n:Node {ExternalID: node.external_id})
                        SET n.channel_ids = node.channel_ids,
                            n.language_ids = node.language_ids,
                            n.document_names = node.document_names,
                            n.collection_ids = node.collection_ids
                    """, nodes=batch_nodes)
            finally:
                session.close()
            
            print(f"Updated {len(batch_nodes)} nodes")

    def load_document_metadata(self, file_path: str, batch_size: int = 5000):
        """
        Load document metadata from JSON file and update existing nodes.
        
        This function loads the entire document_metadata.json file into memory,
        structures it by DocExternalID, and updates existing Neo4j nodes with
        the metadata properties. It only updates existing nodes - no new nodes are created.
        
        Args:
            file_path: Path to document_metadata.json file
            batch_size: Number of nodes to update per batch
        """
        print(f"Loading document metadata from {file_path}...")
        
        # Load entire JSON file into memory
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                metadata_records = json.load(f)
                
            if not metadata_records:
                print("No metadata records found in file.")
                return
                
            print(f"Loaded {len(metadata_records)} metadata records")
            
        except Exception as e:
            print(f"Error loading JSON file: {e}")
            raise
        
        # Structure metadata by DocExternalID
        print("Structuring metadata by DocExternalID...")
        document_metadata = defaultdict(dict)
        
        for record in tqdm(metadata_records, desc="Processing metadata", unit="records", 
                          mininterval=0.5, disable=False):
            doc_id = record.get('DocExternalID')
            metadata_type = record.get('MetadataTypeName')
            metadata_value = record.get('DocumentMetadataValue')
            
            if doc_id and metadata_type is not None:
                document_metadata[doc_id][metadata_type] = metadata_value
        
        print(f"Structured metadata for {len(document_metadata)} unique documents")
        
        # Update existing nodes in Neo4j
        self._update_nodes_with_document_metadata(document_metadata, batch_size)
    
    def _update_nodes_with_document_metadata(self, document_metadata: Dict[str, Dict], 
                                            batch_size: int = 5000):
        """
        Update existing nodes in Neo4j with document metadata.
        
        This function only updates existing nodes that match the DocExternalID.
        If a node doesn't exist, it's skipped (no new nodes are created).
        
        Args:
            document_metadata: Dictionary mapping DocExternalID to property dictionaries
            batch_size: Number of nodes to update per batch
        """
        update_progress = tqdm(desc="Updating Neo4j nodes", unit="nodes", 
                               mininterval=0.5, disable=False,
                               total=len(document_metadata))
        
        try:
            # Process nodes in batches
            doc_ids = list(document_metadata.keys())
            
            for i in range(0, len(doc_ids), batch_size):
                batch_doc_ids = doc_ids[i:i + batch_size]
                self._update_document_metadata_batch(document_metadata, batch_doc_ids)
                update_progress.update(len(batch_doc_ids))
            
            update_progress.close()
            print(f"Updated {update_progress.n} nodes with document metadata")
            
        except Exception as e:
            print(f"Error during document metadata update: {e}")
            update_progress.close()
            raise
    
    def _update_document_metadata_batch(self, document_metadata: Dict[str, Dict], 
                                       doc_ids: List[str]):
        """
        Update a batch of existing nodes with document metadata.
        
        Args:
            document_metadata: Dictionary with all document metadata
            doc_ids: List of DocExternalIDs to update
        """
        with self.driver.session() as session:
            try:
                # Prepare batch data
                batch_documents = []
                for doc_id in doc_ids:
                    metadata = document_metadata[doc_id]
                    batch_documents.append({
                        'external_id': doc_id,
                        'metadata': metadata
                    })
                
                if batch_documents:
                    # Update only existing nodes using MERGE + SET
                    session.run("""
                        UNWIND $docs AS doc
                        MATCH (n:Node {ExternalID: doc.external_id})
                        UNWIND keys(doc.metadata) AS key
                        SET n[key] = doc.metadata[key]
                    """, docs=batch_documents)
                    
                    print(f"Updated {len(batch_documents)} document nodes")
            finally:
                session.close()

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Load Connections.json to Neo4j or update existing nodes')
    parser.add_argument('--uri', default='bolt://localhost:7687', help='Neo4j URI')
    parser.add_argument('--user', default='neo4j', help='Neo4j username')
    parser.add_argument('--password', default='password', help='Neo4j password')
    parser.add_argument('--input', required=True, help='Input JSON file path')
    parser.add_argument('--create-indexes', action='store_true', help='Create indexes before loading')
    parser.add_argument('--clear-before-load', action='store_true', 
                        help='Clear database before loading (WARNING: This will delete all existing data)')
    parser.add_argument('--update-nodes-only', action='store_true', 
                        help='Update existing nodes with new metadata without creating relationships')
    parser.add_argument('--batch-size', type=int, default=5000, 
                        help='Number of nodes per batch for update operation')
    parser.add_argument('--update-metadata', action='store_true', 
                        help='Update existing nodes with new metadata from document_metadata.json')
    
    
    args = parser.parse_args()
    
    loader = Neo4jConnectionLoader(uri=args.uri, user=args.user, password=args.password)
    
    try:
        # Clear database if requested
        if args.clear_before_load:
            print("\n" + "="*60)
            print("WARNING: DATABASE CLEAR REQUESTED")
            print("="*60)
            print("This will delete ALL nodes and relationships from the database.")
            print("Press Enter to continue or Ctrl+C to cancel...")
            try:
                input()  # Wait for user confirmation
            except KeyboardInterrupt:
                print("\nOperation cancelled by user.")
                sys.exit(0)
            
            print("\nClearing database...")
            loader.clear_database()
            print()
        
        if args.create_indexes:
            print("Creating indexes...")
            loader.create_indexes()
        
        if args.update_nodes_only:
            # Update existing nodes with new metadata
            print("Updating existing nodes with new metadata...")
            loader.update_nodes_from_json(args.input, batch_size=args.batch_size)
        else:
            # Normal load operation (nodes and relationships)
            loader.process_json_lazy(args.input)
        
        if args.update_metadata:
            # Update existing nodes with new metadata from document_metadata.json
            print("Updating existing nodes with new metadata from document_metadata.json...")
            loader.load_document_metadata(args.input, batch_size=args.batch_size)
        
        stats = loader.get_stats()
        print(f"\nFinal stats: {stats}")
        
    finally:
        loader.close()


if __name__ == "__main__":
    main()
