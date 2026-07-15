export { sendNotification } from "./service";
export type {
  ChannelOutcome,
  NotificationResult,
  Recipient,
  SendNotificationInput,
} from "./service";
export { templates } from "./templates";
export type { NotificationPayloads, TemplateId } from "./payloads";
export { getEmailProvider, setEmailProvider } from "./email";
export { getSmsProvider, setSmsProvider, isSmsEnabled, normalizePhone, prepareSmsBody } from "./sms";
export type {
  EmailMessage,
  EmailProvider,
  SendResult,
  SmsMessage,
  SmsProvider,
} from "./provider";
