# Data migration: set category/city to "other" where value not in choices

from django.db import migrations

VALID_CATEGORIES = {"plumbing", "electrical", "cleaning", "repair", "construction", "other"}
VALID_CITIES = {"yerevan", "gyumri", "vanadzor", "abovyan", "ejmiatsin", "other"}


def migrate_category_city(apps, schema_editor):
    JobRequest = apps.get_model("marketplace", "JobRequest")
    for job in JobRequest.objects.all():
        updated = False
        if job.category not in VALID_CATEGORIES:
            job.category = "other"
            updated = True
        if job.city not in VALID_CITIES:
            job.city = "other"
            updated = True
        if updated:
            job.save()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0004_category_city_choices"),
    ]

    operations = [
        migrations.RunPython(migrate_category_city, noop),
    ]
