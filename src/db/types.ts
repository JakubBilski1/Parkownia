import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type * as schema from "./schema";

export type SelectUser = InferSelectModel<typeof schema.users>;
export type InsertUser = InferInsertModel<typeof schema.users>;

export type SelectUserRole = InferSelectModel<typeof schema.userRoles>;
export type InsertUserRole = InferInsertModel<typeof schema.userRoles>;

export type SelectBusinessProfile = InferSelectModel<typeof schema.businessProfiles>;
export type InsertBusinessProfile = InferInsertModel<typeof schema.businessProfiles>;

export type SelectRefreshToken = InferSelectModel<typeof schema.refreshTokens>;
export type InsertRefreshToken = InferInsertModel<typeof schema.refreshTokens>;

export type SelectConsent = InferSelectModel<typeof schema.consents>;
export type InsertConsent = InferInsertModel<typeof schema.consents>;

export type SelectActionToken = InferSelectModel<typeof schema.actionTokens>;
export type InsertActionToken = InferInsertModel<typeof schema.actionTokens>;

export type SelectParking = InferSelectModel<typeof schema.parkings>;
export type InsertParking = InferInsertModel<typeof schema.parkings>;

export type SelectParkingPhoto = InferSelectModel<typeof schema.parkingPhotos>;
export type InsertParkingPhoto = InferInsertModel<typeof schema.parkingPhotos>;

export type SelectParkingAvailabilityWindow = InferSelectModel<
  typeof schema.parkingAvailabilityWindows
>;
export type InsertParkingAvailabilityWindow = InferInsertModel<
  typeof schema.parkingAvailabilityWindows
>;

export type SelectParkingBlackoutDate = InferSelectModel<typeof schema.parkingBlackoutDates>;
export type InsertParkingBlackoutDate = InferInsertModel<typeof schema.parkingBlackoutDates>;

export type SelectVenue = InferSelectModel<typeof schema.venues>;
export type InsertVenue = InferInsertModel<typeof schema.venues>;

export type SelectEvent = InferSelectModel<typeof schema.events>;
export type InsertEvent = InferInsertModel<typeof schema.events>;

export type SelectEventParkingAvailability = InferSelectModel<
  typeof schema.eventParkingAvailability
>;
export type InsertEventParkingAvailability = InferInsertModel<
  typeof schema.eventParkingAvailability
>;

export type SelectBooking = InferSelectModel<typeof schema.bookings>;
export type InsertBooking = InferInsertModel<typeof schema.bookings>;

export type SelectBookingScan = InferSelectModel<typeof schema.bookingScans>;
export type InsertBookingScan = InferInsertModel<typeof schema.bookingScans>;

export type SelectPayment = InferSelectModel<typeof schema.payments>;
export type InsertPayment = InferInsertModel<typeof schema.payments>;

export type SelectWebhookEvent = InferSelectModel<typeof schema.webhookEvents>;
export type InsertWebhookEvent = InferInsertModel<typeof schema.webhookEvents>;

export type SelectPayout = InferSelectModel<typeof schema.payouts>;
export type InsertPayout = InferInsertModel<typeof schema.payouts>;

export type SelectPayoutItem = InferSelectModel<typeof schema.payoutItems>;
export type InsertPayoutItem = InferInsertModel<typeof schema.payoutItems>;

export type SelectCommissionRule = InferSelectModel<typeof schema.commissionRules>;
export type InsertCommissionRule = InferInsertModel<typeof schema.commissionRules>;

export type SelectRefundPolicy = InferSelectModel<typeof schema.refundPolicies>;
export type InsertRefundPolicy = InferInsertModel<typeof schema.refundPolicies>;

export type SelectNotificationLog = InferSelectModel<typeof schema.notificationLog>;
export type InsertNotificationLog = InferInsertModel<typeof schema.notificationLog>;

export type SelectRateLimit = InferSelectModel<typeof schema.rateLimits>;
export type InsertRateLimit = InferInsertModel<typeof schema.rateLimits>;

export type Role = (typeof schema.roleEnum.enumValues)[number];
export type ConsentKind = (typeof schema.consentKindEnum.enumValues)[number];
export type ActionTokenPurpose = (typeof schema.actionTokenPurposeEnum.enumValues)[number];
export type OwnerType = (typeof schema.ownerTypeEnum.enumValues)[number];
export type ParkingStatus = (typeof schema.parkingStatusEnum.enumValues)[number];
export type ParkingType = (typeof schema.parkingTypeEnum.enumValues)[number];
export type AccessType = (typeof schema.accessTypeEnum.enumValues)[number];
export type Surface = (typeof schema.surfaceEnum.enumValues)[number];
export type VehicleType = (typeof schema.vehicleTypeEnum.enumValues)[number];
export type EvConnectorType = (typeof schema.evConnectorTypeEnum.enumValues)[number];
export type AvailabilityMode = (typeof schema.availabilityModeEnum.enumValues)[number];
export type EventCategory = (typeof schema.eventCategoryEnum.enumValues)[number];
export type BookingStatus = (typeof schema.bookingStatusEnum.enumValues)[number];
export type ScanResult = (typeof schema.scanResultEnum.enumValues)[number];
export type PaymentProvider = (typeof schema.paymentProviderEnum.enumValues)[number];
export type PaymentMethod = (typeof schema.paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof schema.paymentStatusEnum.enumValues)[number];
export type PayoutStatus = (typeof schema.payoutStatusEnum.enumValues)[number];
export type CommissionScope = (typeof schema.commissionScopeEnum.enumValues)[number];
export type NotificationChannel = (typeof schema.notificationChannelEnum.enumValues)[number];
export type NotificationStatus = (typeof schema.notificationStatusEnum.enumValues)[number];

export type { Pkd, RefundRule, ScheduleSlot, WeeklySchedule } from "./schema";
export type { BoundingBox, Point } from "./geo";
