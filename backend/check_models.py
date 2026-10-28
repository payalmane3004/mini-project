
from database import Base
import models

print("SQLAlchemy models loaded successfully!")
print("Tables registered:")

for table_name in Base.metadata.tables:
    print("-", table_name)
