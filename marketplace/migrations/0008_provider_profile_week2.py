# Generated migration for Week 2: provider profile (portfolio, completed_jobs_count, rating_avg)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0007_add_job_status_deleted"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerprofile",
            name="portfolio",
            field=models.JSONField(blank=True, default=list, help_text="List of {url, title} for portfolio links/photos"),
        ),
        migrations.AddField(
            model_name="providerprofile",
            name="completed_jobs_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="providerprofile",
            name="rating_avg",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
