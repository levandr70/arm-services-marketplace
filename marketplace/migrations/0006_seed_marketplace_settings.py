# Data migration: ensure a single MarketplaceSettings row exists

from django.db import migrations


def seed_marketplace_settings(apps, schema_editor):
    MarketplaceSettings = apps.get_model("marketplace", "MarketplaceSettings")
    if not MarketplaceSettings.objects.filter(key="global").exists():
        MarketplaceSettings.objects.create(
            key="global",
            default_response_price_credits=1,
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0005_migrate_category_city_to_choices"),
    ]

    operations = [
        migrations.RunPython(seed_marketplace_settings, noop),
    ]
