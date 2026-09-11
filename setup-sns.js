// One-time setup: creates a dedicated SNS topic for this project and subscribes
// the phone number for SMS notifications. Run with: node setup-sns.js
// Requires AWS credentials configured locally with permission to create SNS
// topics/subscriptions (e.g. via `aws configure` or environment variables).

const { SNSClient, CreateTopicCommand, SubscribeCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'us-west-2';
const TOPIC_NAME = 'costa-mesa-497-monitor-notifications';
const PHONE_NUMBER = '+12154981116';

async function main() {
    const sns = new SNSClient({ region: REGION });

    const { TopicArn } = await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }));
    console.log(`Topic ready: ${TopicArn}`);

    await sns.send(new SubscribeCommand({
        TopicArn,
        Protocol: 'sms',
        Endpoint: PHONE_NUMBER
    }));
    console.log(`Subscribed ${PHONE_NUMBER} for SMS (no confirmation needed for SMS).`);

    console.log('\nNext step: put this ARN into config.json as "snsTopicArn":');
    console.log(TopicArn);
}

main().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
});
