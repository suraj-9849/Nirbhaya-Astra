# This follows your project structure and uses get_database from backend.db

from db import get_database
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def insert_numbers():
    try:
        db = get_database()
        collection = db["numbers"]

        # Clear existing data (optional)
        collection.delete_many({})

        # Insert numbers 1 to 10
        docs = [{"number": i} for i in range(1, 11)]
        result = collection.insert_many(docs)

        logger.info(f"Inserted {len(result.inserted_ids)} documents into 'numbers' collection.")
        return True
    except Exception as e:
        logger.error(f"Error inserting numbers: {str(e)}")
        return False

# Run only when this script is executed directly
if __name__ == "__main__":
    if insert_numbers():
        print("✅ Numbers inserted successfully.")
    else:
        print("❌ Failed to insert numbers.")
