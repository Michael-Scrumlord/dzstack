export interface TemplateData {
  orderId: string;
  customerId?: string;
}

const templates: Record<string, (data: TemplateData) => { subject: string; body: string }> = {
  "order.confirmed": (d) => ({
    subject: `Order ${d.orderId} confirmed`,
    body: `Thanks${d.customerId ? `, ${d.customerId}` : ""}! Your order ${d.orderId} is confirmed and will ship soon.`,
  }),
  "order.cancelled": (d) => ({
    subject: `Order ${d.orderId} cancelled`,
    body: `Your order ${d.orderId} was cancelled. Nothing was charged.`,
  }),
  "order.expired": (d) => ({
    subject: `Your basket ${d.orderId} expired`,
    body: `We held the items in order ${d.orderId} for a while but did not get your payment, so they went back on the shelf.`,
  }),
};

export function hasTemplate(eventType: string): boolean {
  return eventType in templates;
}

export function render(eventType: string, data: TemplateData): { subject: string; body: string } {
  const template = templates[eventType];
  if (!template) throw new Error(`no template for ${eventType}`);
  return template(data);
}
