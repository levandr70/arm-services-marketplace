# Remove old category/city CharFields and rename category_fk -> category, city_fk -> city

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0010_seed_category_city_backfill_fks"),
    ]

    operations = [
        migrations.RemoveField(model_name="jobrequest", name="category"),
        migrations.RemoveField(model_name="jobrequest", name="city"),
        migrations.RenameField(model_name="jobrequest", old_name="category_fk", new_name="category"),
        migrations.RenameField(model_name="jobrequest", old_name="city_fk", new_name="city"),
    ]
