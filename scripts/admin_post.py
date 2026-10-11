"""Admin-only community post moderation helper.

The caller must provide AWS credentials and choose TABLE/BUCKET explicitly.
"""
import argparse
import os
import boto3
from boto3.dynamodb.conditions import Key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("hide", "unhide", "delete"))
    parser.add_argument("post_id")
    args = parser.parse_args()
    table_name = os.environ["TABLE"]
    table = boto3.resource("dynamodb").Table(table_name)
    key = {"pk": f"POST#{args.post_id}", "sk": "META"}
    item = table.get_item(Key=key).get("Item")
    if not item:
        raise SystemExit("post not found")
    if args.action == "delete":
        items = []
        query = {"KeyConditionExpression": Key("pk").eq(f"POST#{args.post_id}")}
        while True:
            page = table.query(**query)
            items.extend(page.get("Items", []))
            if not page.get("LastEvaluatedKey"):
                break
            query["ExclusiveStartKey"] = page["LastEvaluatedKey"]
        requests = [{"DeleteRequest": {"Key": {"pk": i["pk"], "sk": i["sk"]}}} for i in items]
        for start in range(0, len(requests), 25):
            table.meta.client.batch_write_item(
                RequestItems={table_name: requests[start:start + 25]}
            )
        if item.get("photoKey") and os.environ.get("BUCKET"):
            boto3.client("s3").delete_object(Bucket=os.environ["BUCKET"], Key=item["photoKey"])
    else:
        table.update_item(
            Key=key,
            UpdateExpression="SET #status = :status",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": "hidden" if args.action == "hide" else "visible"},
        )
    print(f"{args.action}: {args.post_id}")


if __name__ == "__main__":
    main()
