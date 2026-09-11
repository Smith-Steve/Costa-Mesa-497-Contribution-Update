// One-time setup: creates a dedicated SNS topic for this project and subscribes
// an email address for notifications. Run with: node setup-sns.js
// Requires AWS credentials configured locally with permission to create SNS
// topics/subscriptions (e.g. via `aws configure` or environment variables).
//
// Note: SMS via SNS was tried first, but this AWS account's SMS sending
// (even the sandbox verification code) is silently dropped, most likely
// because AWS SMS to US numbers requires A2P 10DLC carrier registration
// that hasn't been done. Email doesn't have that problem, so that's what
// this project uses.

const { SNSClient, CreateTopicCommand, SubscribeCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'us-west-2';
const TOPIC_NAME = 'costa-mesa-497-monitor-notifications';
const NOTIFICATION_EMAIL = 'steve@steve4costamesa.com';

async function main() {
    const sns = new SNSClient({ region: REGION });

    const { TopicArn } = await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }));
    console.log(`Topic ready: ${TopicArn}`);

    await sns.send(new SubscribeCommand({
        TopicArn,
        Protocol: 'email',
        Endpoint: NOTIFICATION_EMAIL
    }));
    console.log(`Subscription request sent to ${NOTIFICATION_EMAIL}. Check that inbox and click the confirmation link.`);

    console.log('\nNext step: put this ARN into config.json as "snsTopicArn":');
    console.log(TopicArn);
}

main().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
});
