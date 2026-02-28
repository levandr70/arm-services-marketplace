# Data migration: seed Category and City, backfill JobRequest.category_fk and city_fk

from django.db import migrations

CATEGORY_DATA = [
    ("plumbing", "Plumbing", 0),
    ("electrical", "Electrical", 1),
    ("cleaning", "Cleaning", 2),
    ("repair", "Repair", 3),
    ("construction", "Construction", 4),
    ("other", "Other", 99),
]
CITY_DATA = [
    ("yerevan", "Yerevan", 0),
    ("gyumri", "Gyumri", 1),
    ("vanadzor", "Vanadzor", 2),
    ("abovyan", "Abovyan", 3),
    ("ejmiatsin", "Ejmiatsin", 4),
    ("other", "Other", 99),
]


def seed_and_backfill(apps, schema_editor):
    Category = apps.get_model("marketplace", "Category")
    City = apps.get_model("marketplace", "City")
    JobRequest = apps.get_model("marketplace", "JobRequest")

    for slug, name, order in CATEGORY_DATA:
        Category.objects.get_or_create(slug=slug, defaults={"name": name, "sort_order": order})
    for slug, name, order in CITY_DATA:
        City.objects.get_or_create(slug=slug, defaults={"name": name, "sort_order": order})

    cat_by_slug = {c.slug: c for c in Category.objects.all()}
    city_by_slug = {c.slug: c for c in City.objects.all()}

    for job in JobRequest.objects.all():
        if job.category and job.category in cat_by_slug:
            job.category_fk_id = cat_by_slug[job.category].id
        if job.city and job.city in city_by_slug:
            job.city_fk_id = city_by_slug[job.city].id
        job.save(update_fields=["category_fk_id", "city_fk_id"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0009_add_category_city_and_fks"),
    ]

    operations = [
        migrations.RunPython(seed_and_backfill, noop),
    ]
