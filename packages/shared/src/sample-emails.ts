export interface SampleEmail {
  id: string;
  name: string;
  description: string;
  item: {
    json: {
      messageId: string;
      threadId: string;
      from: {
        name: string;
        email: string;
      };
      to: string[];
      subject: string;
      bodyText: string;
      bodyHtml?: string;
      isBulk: boolean;
      receivedAt: string;
      labels: string[];
    };
  };
}

export const SAMPLE_EMAILS: SampleEmail[] = [
  {
    id: 'support_question',
    name: 'Customer Support Question',
    description: 'A customer reporting an issue and asking for technical help.',
    item: {
      json: {
        messageId: 'msg_support_101',
        threadId: 'th_support_101',
        from: {
          name: 'Sarah Connor',
          email: 'sarah.connor@cyberdyne.org',
        },
        to: ['support@flowcart.local'],
        subject: 'Cannot connect my Google account on Safari',
        bodyText: 'Hi team, whenever I click Connect Gmail on Safari version 17, the popup closes immediately with error code OAUTH_POPUP_BLOCKED. Can you please advise how to fix this? Thanks, Sarah',
        bodyHtml: '<p>Hi team, whenever I click Connect Gmail on Safari version 17, the popup closes immediately with error code OAUTH_POPUP_BLOCKED. Can you please advise how to fix this? Thanks, Sarah</p>',
        isBulk: false,
        receivedAt: new Date().toISOString(),
        labels: ['INBOX', 'UNREAD'],
      },
    },
  },
  {
    id: 'sales_lead',
    name: 'Sales Lead / Pricing Inquiry',
    description: 'A potential enterprise customer asking for custom pricing and a demo.',
    item: {
      json: {
        messageId: 'msg_sales_202',
        threadId: 'th_sales_202',
        from: {
          name: 'Marcus Vance',
          email: 'marcus.vance@databridge.co',
        },
        to: ['sales@flowcart.local'],
        subject: 'Enterprise pricing for 50 mailboxes',
        bodyText: 'Hello FlowCart team, we are evaluating automated email assistants for our customer operations team of 50 reps. Do you offer an enterprise self-hosted license with dedicated support? We would like to schedule a quick demo this Thursday if possible. Best, Marcus',
        bodyHtml: '<p>Hello FlowCart team, we are evaluating automated email assistants for our customer operations team of 50 reps. Do you offer an enterprise self-hosted license with dedicated support? We would like to schedule a quick demo this Thursday if possible. Best, Marcus</p>',
        isBulk: false,
        receivedAt: new Date().toISOString(),
        labels: ['INBOX', 'UNREAD'],
      },
    },
  },
  {
    id: 'billing_inquiry',
    name: 'Billing / Invoice Query',
    description: 'An inquiry regarding payment receipt and tax invoice.',
    item: {
      json: {
        messageId: 'msg_billing_303',
        threadId: 'th_billing_303',
        from: {
          name: 'Elena Rostova',
          email: 'finance@acmeventures.com',
        },
        to: ['billing@flowcart.local'],
        subject: 'Invoice copy for subscription renewal INV-98421',
        bodyText: 'Hello, our accounts department requires a VAT-compliant PDF copy of invoice INV-98421 charged to our company card on Oct 1. Please send it over at your earliest convenience.',
        bodyHtml: '<p>Hello, our accounts department requires a VAT-compliant PDF copy of invoice INV-98421 charged to our company card on Oct 1. Please send it over at your earliest convenience.</p>',
        isBulk: false,
        receivedAt: new Date().toISOString(),
        labels: ['INBOX', 'UNREAD'],
      },
    },
  },
  {
    id: 'newsletter_promotions',
    name: 'Promotions / Newsletter',
    description: 'Bulk marketing newsletter with promotions.',
    item: {
      json: {
        messageId: 'msg_promo_404',
        threadId: 'th_promo_404',
        from: {
          name: 'Cloud Weekly Digest',
          email: 'newsletter@cloudpulse-news.com',
        },
        to: ['user@flowcart.local'],
        subject: 'Cloud Weekly #42: Modern Web Performance & Next-Gen Workflows',
        bodyText: 'Here is your weekly roundup of developer tooling, cloud architecture best practices, and automation trends. Click here to unsubscribe: https://example.com/unsub',
        bodyHtml: '<p>Here is your weekly roundup of developer tooling, cloud architecture best practices, and automation trends.</p>',
        isBulk: true,
        receivedAt: new Date().toISOString(),
        labels: ['PROMOTIONS', 'UNREAD'],
      },
    },
  },
];
