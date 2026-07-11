import sqlite3

def print_table_data(db_name="cap_local.db"):
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall() if not t[0].startswith("sqlite_")]
        
        if not tables:
            print("No tables found in database.")
            return

        for table in tables:
            print(f"\n==================================================")
            print(f" TABLE: {table.upper()}")
            print(f"==================================================")
            
            cursor.execute(f"SELECT * FROM {table}")
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            
            # Print column headers
            header = " | ".join(columns)
            print(header)
            print("-" * len(header))
            
            # Print rows
            if not rows:
                print("(No records found)")
            for row in rows:
                # Mask passwords for cleaner display
                row_display = []
                for col_name, val in zip(columns, row):
                    if "password" in col_name:
                        row_display.append("[MASKED]")
                    else:
                        row_display.append(str(val))
                print(" | ".join(row_display))
        
        conn.close()
    except Exception as e:
        print(f"Error querying database: {e}")

if __name__ == "__main__":
    print_table_data()
