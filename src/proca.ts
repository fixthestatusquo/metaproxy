import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /**
   * The `Date` scalar type represents a date. The Date appears in a JSON
   * response as an ISO8601 formatted string, without a time component.
   */
  Date: any;
  /**
   * The `DateTime` scalar type represents a date and time in the UTC
   * timezone. The DateTime appears in a JSON response as an ISO8601 formatted
   * string, including UTC timezone ("Z"). The parsed date and time string will
   * be converted to UTC if there is an offset.
   */
  DateTime: any;
  Json: any;
  /**
   * The `Naive DateTime` scalar type represents a naive date and time without
   * timezone. The DateTime appears in a JSON response as an ISO8601 formatted
   * string.
   */
  NaiveDateTime: any;
};

export type Action = {
  __typename?: 'Action';
  actionId: Scalars['Int'];
  actionPage: ActionPage;
  actionType: Scalars['String'];
  campaign: Campaign;
  contact: Contact;
  createdAt: Scalars['NaiveDateTime'];
  customFields: Scalars['Json'];
  donation: Maybe<Donation>;
  /**
   * Deprecated, use customFields
   * @deprecated use custom_fields
   */
  fields: Array<CustomField>;
  privacy: Consent;
  tracking: Maybe<Tracking>;
};

export type ActionCustomFields = {
  __typename?: 'ActionCustomFields';
  actionId: Scalars['Int'];
  actionType: Scalars['String'];
  customFields: Scalars['Json'];
  /** @deprecated use custom_fields */
  fields: Array<CustomField>;
  insertedAt: Scalars['NaiveDateTime'];
};

/** Custom field added to action. For signature it can be contact, for mail it can be subject and body */
export type ActionInput = {
  /** Action Type */
  actionType: Scalars['String'];
  /** Custom fields added to action */
  customFields?: InputMaybe<Scalars['Json']>;
  /** Donation payload */
  donation?: InputMaybe<DonationActionInput>;
  /** Deprecated format: Other fields added to action */
  fields?: InputMaybe<Array<CustomFieldInput>>;
  /** MTT payload */
  mtt?: InputMaybe<MttActionInput>;
  /** Test mode */
  testing?: InputMaybe<Scalars['Boolean']>;
};

export type ActionPage = {
  /** Campaign this action page belongs to. */
  campaign: Campaign;
  /** Config JSON of this action page */
  config: Scalars['Json'];
  id: Scalars['Int'];
  /** List of steps in journey (DEPRECATED: moved under config) */
  journey: Array<Scalars['String']>;
  /** Is live? */
  live: Scalars['Boolean'];
  /** Locale for the widget, in i18n format */
  locale: Scalars['String'];
  /** Name where the widget is hosted */
  name: Scalars['String'];
  /** Org the action page belongs to */
  org: Org;
  /** Thank you email templated of this Action Page */
  thankYouTemplate: Maybe<Scalars['String']>;
  /** A reference to thank you email template of this ActionPage */
  thankYouTemplateRef: Maybe<Scalars['String']>;
};

/** ActionPage input */
export type ActionPageInput = {
  /** JSON string containing Action Page config */
  config?: InputMaybe<Scalars['Json']>;
  /** Collected PII is processed even with no opt-in */
  delivery?: InputMaybe<Scalars['Boolean']>;
  /** Extra supporter count. If you want to add a number of signatories you have offline or kept in another system, you can specify the number here. */
  extraSupporters?: InputMaybe<Scalars['Int']>;
  /** 2-letter, lowercase, code of ActionPage language */
  locale?: InputMaybe<Scalars['String']>;
  /**
   * Unique NAME identifying ActionPage.
   *
   * Does not have to exist, must be unique. Can be a 'technical' identifier
   * scoped to particular organization, so it does not have to change when the
   * slugs/names change (eg. some.org/1234). However, frontent Widget can
   * ask for ActionPage by it's current location.href (but without https://), in which case it is useful
   * to make this url match the real widget location.
   */
  name?: InputMaybe<Scalars['String']>;
  /** Supporter confirm email template of this ActionPage */
  supporterConfirmTemplate?: InputMaybe<Scalars['String']>;
  /** Thank you email template of this ActionPage */
  thankYouTemplate?: InputMaybe<Scalars['String']>;
};

export enum ActionPageStatus {
  /** This action page received actions lately */
  Active = 'ACTIVE',
  /** This action page did not receive actions lately */
  Stalled = 'STALLED',
  /** This action page is ready to receive first action or is stalled for over 1 year */
  Standby = 'STANDBY'
}

/** Count of actions for particular action type */
export type ActionTypeCount = {
  __typename?: 'ActionTypeCount';
  /** action type */
  actionType: Scalars['String'];
  /** count of actions of action type */
  count: Scalars['Int'];
};

export type ActivateKeyResult = {
  __typename?: 'ActivateKeyResult';
  status: Status;
};

export type AddKeyInput = {
  name: Scalars['String'];
  public: Scalars['String'];
};

/** Address type which can hold different addres fields. */
export type AddressInput = {
  /** Country code (two-letter). */
  country?: InputMaybe<Scalars['String']>;
  /** Locality, which can be a city/town/village */
  locality?: InputMaybe<Scalars['String']>;
  /** Postcode, in format correct for country locale */
  postcode?: InputMaybe<Scalars['String']>;
  /** Region, being province, voyevodship, county */
  region?: InputMaybe<Scalars['String']>;
  /** Street name */
  street?: InputMaybe<Scalars['String']>;
  /** Street number */
  streetNumber?: InputMaybe<Scalars['String']>;
};

/** Api token metadata */
export type ApiToken = {
  __typename?: 'ApiToken';
  expiresAt: Scalars['NaiveDateTime'];
};

/** Count of actions for particular action type */
export type AreaCount = {
  __typename?: 'AreaCount';
  /** area */
  area: Scalars['String'];
  /** count of supporters in this area */
  count: Scalars['Int'];
};

export type Campaign = {
  /** Fetch public actions */
  actions: PublicActionsResult;
  /** Custom config map */
  config: Scalars['Json'];
  /** Schema for contact personal information */
  contactSchema: ContactSchema;
  /** External ID (if set) */
  externalId: Maybe<Scalars['Int']>;
  /** Campaign id */
  id: Scalars['Int'];
  /** Internal name of the campaign */
  name: Scalars['String'];
  org: Org;
  /** Campaign statistics */
  stats: CampaignStats;
  targets: Maybe<Array<Maybe<Target>>>;
  /** Full, official name of the campaign */
  title: Scalars['String'];
};


export type CampaignActionsArgs = {
  actionType: Scalars['String'];
  limit: Scalars['Int'];
};

/** Campaign input */
export type CampaignInput = {
  /** Action pages of this campaign */
  actionPages?: InputMaybe<Array<ActionPageInput>>;
  /** Custom config as stringified JSON map */
  config?: InputMaybe<Scalars['Json']>;
  /** Schema for contact personal information */
  contactSchema?: InputMaybe<ContactSchema>;
  /** Campaign external_id. If provided, it will be used to find campaign. Can be used to rename a campaign */
  externalId?: InputMaybe<Scalars['Int']>;
  /** MTT configuration */
  mtt?: InputMaybe<CampaignMttInput>;
  /** Campaign unchanging identifier */
  name?: InputMaybe<Scalars['String']>;
  /** Campaign human readable title */
  title?: InputMaybe<Scalars['String']>;
};

export type CampaignMtt = {
  __typename?: 'CampaignMtt';
  endAt: Scalars['DateTime'];
  messageTemplate: Maybe<Scalars['String']>;
  startAt: Scalars['DateTime'];
  testEmail: Maybe<Scalars['String']>;
};

export type CampaignMttInput = {
  endAt?: InputMaybe<Scalars['DateTime']>;
  messageTemplate?: InputMaybe<Scalars['String']>;
  startAt?: InputMaybe<Scalars['DateTime']>;
  testEmail?: InputMaybe<Scalars['String']>;
};

/** Campaign statistics */
export type CampaignStats = {
  __typename?: 'CampaignStats';
  /** Action counts for selected action types */
  actionCount: Array<ActionTypeCount>;
  /** Unique action tagers count */
  supporterCount: Scalars['Int'];
  /** Unique action takers by area */
  supporterCountByArea: Array<AreaCount>;
  /** Unique action takers by org */
  supporterCountByOrg: Array<OrgCount>;
  supporterCountByOthers: Scalars['Int'];
};


/** Campaign statistics */
export type CampaignStatsSupporterCountByOthersArgs = {
  orgName: Scalars['String'];
};

export type ChangeUserStatus = {
  __typename?: 'ChangeUserStatus';
  status: Status;
};

export type Confirm = {
  __typename?: 'Confirm';
  code: Scalars['String'];
  creator: Maybe<User>;
  email: Maybe<Scalars['String']>;
  message: Maybe<Scalars['String']>;
  objectId: Maybe<Scalars['Int']>;
};

export type ConfirmInput = {
  code: Scalars['String'];
  email?: InputMaybe<Scalars['String']>;
  objectId?: InputMaybe<Scalars['Int']>;
};

export type ConfirmResult = {
  __typename?: 'ConfirmResult';
  actionPage: Maybe<ActionPage>;
  campaign: Maybe<Campaign>;
  message: Maybe<Scalars['String']>;
  org: Maybe<Org>;
  status: Status;
};

/** GDPR consent data for this org */
export type Consent = {
  __typename?: 'Consent';
  emailStatus: EmailStatus;
  emailStatusChanged: Maybe<Scalars['NaiveDateTime']>;
  givenAt: Scalars['NaiveDateTime'];
  optIn: Scalars['Boolean'];
  withConsent: Scalars['Boolean'];
};

/** GDPR consent data structure */
export type ConsentInput = {
  /** Opt in to the campaign leader */
  leadOptIn?: InputMaybe<Scalars['Boolean']>;
  /** Has contact consented to receiving communication from widget owner? */
  optIn: Scalars['Boolean'];
};

export type Contact = {
  __typename?: 'Contact';
  contactRef: Scalars['ID'];
  nonce: Maybe<Scalars['String']>;
  payload: Scalars['String'];
  publicKey: Maybe<KeyIds>;
  signKey: Maybe<KeyIds>;
};

/** Contact information */
export type ContactInput = {
  /** Contacts address */
  address?: InputMaybe<AddressInput>;
  /** Date of birth in format YYYY-MM-DD */
  birthDate?: InputMaybe<Scalars['Date']>;
  /** Email */
  email?: InputMaybe<Scalars['String']>;
  /** First name (when you provide full name split into first and last) */
  firstName?: InputMaybe<Scalars['String']>;
  /** Last name (when you provide full name split into first and last) */
  lastName?: InputMaybe<Scalars['String']>;
  /** Full name */
  name?: InputMaybe<Scalars['String']>;
  /** Nationality information */
  nationality?: InputMaybe<NationalityInput>;
  /** Contacts phone number */
  phone?: InputMaybe<Scalars['String']>;
};

export type ContactReference = {
  __typename?: 'ContactReference';
  /** Contact's reference */
  contactRef: Scalars['String'];
  /** Contacts first name */
  firstName: Maybe<Scalars['String']>;
};

export enum ContactSchema {
  Basic = 'BASIC',
  Eci = 'ECI',
  ItCi = 'IT_CI',
  PopularInitiative = 'POPULAR_INITIATIVE'
}

/** Custom field with a key and value. */
export type CustomField = {
  __typename?: 'CustomField';
  key: Scalars['String'];
  value: Scalars['String'];
};

/** Custom field with a key and value. Both are strings. */
export type CustomFieldInput = {
  key: Scalars['String'];
  /** Unused. To mark action_type/key as transient, use campaign.transient_actions list */
  transient?: InputMaybe<Scalars['Boolean']>;
  value: Scalars['String'];
};

export type DeleteUserResult = {
  __typename?: 'DeleteUserResult';
  status: Status;
};

export type Donation = {
  __typename?: 'Donation';
  /** Provide amount of this donation, in smallest units for currency */
  amount: Scalars['Int'];
  /** Provide currency of this donation */
  currency: Scalars['String'];
  /** Donation frequency unit */
  frequencyUnit: DonationFrequencyUnit;
  /** Donation data */
  payload: Scalars['Json'];
  schema: Maybe<DonationSchema>;
};

export type DonationActionInput = {
  /** Provide amount of this donation, in smallest units for currency */
  amount?: InputMaybe<Scalars['Int']>;
  /** Provide currency of this donation */
  currency?: InputMaybe<Scalars['String']>;
  frequencyUnit?: InputMaybe<DonationFrequencyUnit>;
  payload: Scalars['Json'];
  /** Provide payload schema to validate, eg. stripe_payment_intent */
  schema?: InputMaybe<DonationSchema>;
};

export enum DonationFrequencyUnit {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  OneOff = 'ONE_OFF',
  Weekly = 'WEEKLY'
}

export enum DonationSchema {
  StripePaymentIntent = 'STRIPE_PAYMENT_INTENT'
}

export enum EmailStatus {
  Blocked = 'BLOCKED',
  Bounce = 'BOUNCE',
  DoubleOptIn = 'DOUBLE_OPT_IN',
  None = 'NONE',
  Spam = 'SPAM',
  Unsub = 'UNSUB'
}

export type EmailTemplateInput = {
  html?: InputMaybe<Scalars['String']>;
  locale?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
  subject?: InputMaybe<Scalars['String']>;
  text?: InputMaybe<Scalars['String']>;
};

export type GenKeyInput = {
  name: Scalars['String'];
};

export type JoinOrgResult = {
  __typename?: 'JoinOrgResult';
  org: Org;
  status: Status;
};

/** Encryption or sign key with integer id (database) */
export type Key = {
  __typename?: 'Key';
  active: Scalars['Boolean'];
  expired: Scalars['Boolean'];
  /** When the key was expired, in UTC */
  expiredAt: Maybe<Scalars['NaiveDateTime']>;
  id: Scalars['Int'];
  name: Scalars['String'];
  public: Scalars['String'];
};

export type KeyIds = {
  __typename?: 'KeyIds';
  id: Scalars['Int'];
  public: Scalars['String'];
};

export type KeyWithPrivate = {
  __typename?: 'KeyWithPrivate';
  active: Scalars['Boolean'];
  expired: Scalars['Boolean'];
  /** When the key was expired, in UTC */
  expiredAt: Maybe<Scalars['NaiveDateTime']>;
  id: Scalars['Int'];
  name: Scalars['String'];
  private: Scalars['String'];
  public: Scalars['String'];
};

export type LaunchActionPageResult = {
  __typename?: 'LaunchActionPageResult';
  status: Status;
};

export type MttActionInput = {
  /** Body */
  body: Scalars['String'];
  /** Subject line */
  subject: Scalars['String'];
  /** Target ids */
  targets: Array<Scalars['String']>;
};

export type NationalityInput = {
  /** Nationality / issuer of id document */
  country: Scalars['String'];
  /** Document serial id/number */
  documentNumber?: InputMaybe<Scalars['String']>;
  /** Document type */
  documentType?: InputMaybe<Scalars['String']>;
};

export type Org = {
  /** config */
  config: Scalars['Json'];
  /** Organisation short name */
  name: Scalars['String'];
  /** Organisation title (human readable name) */
  title: Scalars['String'];
};

/** Count of supporters for particular org */
export type OrgCount = {
  __typename?: 'OrgCount';
  /** count of supporters registered by org */
  count: Scalars['Int'];
  /** org */
  org: Org;
};

export type OrgInput = {
  /** Config */
  config?: InputMaybe<Scalars['Json']>;
  /** Schema for contact personal information */
  contactSchema?: InputMaybe<ContactSchema>;
  /** Only send thank you emails to opt-ins */
  doiThankYou?: InputMaybe<Scalars['Boolean']>;
  /** Name used to rename */
  name?: InputMaybe<Scalars['String']>;
  /** Email opt in enabled */
  supporterConfirm?: InputMaybe<Scalars['Boolean']>;
  /** Email opt in template name */
  supporterConfirmTemplate?: InputMaybe<Scalars['String']>;
  /** Organisation title (human readable name) */
  title?: InputMaybe<Scalars['String']>;
};

export type OrgUser = {
  __typename?: 'OrgUser';
  /** Date and time the user was created on this instance */
  createdAt: Scalars['NaiveDateTime'];
  email: Scalars['String'];
  /** Date and time when user joined org */
  joinedAt: Scalars['NaiveDateTime'];
  /** Will be removed */
  lastSigninAt: Maybe<Scalars['NaiveDateTime']>;
  /** Role in an org */
  role: Scalars['String'];
};

export type OrgUserInput = {
  email: Scalars['String'];
  role: Scalars['String'];
};

export type Partnership = {
  __typename?: 'Partnership';
  actionPages: Array<ActionPage>;
  launchRequesters: Array<User>;
  launchRequests: Array<Confirm>;
  org: Org;
};

export type PersonalData = {
  __typename?: 'PersonalData';
  /** Schema for contact personal information */
  contactSchema: ContactSchema;
  /** Only send thank you emails to opt-ins */
  doiThankYou: Scalars['Boolean'];
  /** High data security enabled */
  highSecurity: Scalars['Boolean'];
  /** Email opt in enabled */
  supporterConfirm: Scalars['Boolean'];
  /** Email opt in template name */
  supporterConfirmTemplate: Maybe<Scalars['String']>;
};

export type PrivateActionPage = ActionPage & {
  __typename?: 'PrivateActionPage';
  /** Campaign this action page belongs to. */
  campaign: Campaign;
  /** Config JSON of this action page */
  config: Scalars['Json'];
  /** Action page collects also opt-out actions */
  delivery: Scalars['Boolean'];
  extraSupporters: Scalars['Int'];
  id: Scalars['Int'];
  /** List of steps in journey (DEPRECATED: moved under config) */
  journey: Array<Scalars['String']>;
  /** Is live? */
  live: Scalars['Boolean'];
  /** Locale for the widget, in i18n format */
  locale: Scalars['String'];
  /** Location of the widget as last seen in HTTP REFERER header */
  location: Maybe<Scalars['String']>;
  /** Name where the widget is hosted */
  name: Scalars['String'];
  /** Org the action page belongs to */
  org: Org;
  /** Status of action page */
  status: Maybe<ActionPageStatus>;
  /** Email template to confirm supporter */
  supporterConfirmTemplate: Maybe<Scalars['String']>;
  /** Thank you email templated of this Action Page */
  thankYouTemplate: Maybe<Scalars['String']>;
  /** A reference to thank you email template of this ActionPage */
  thankYouTemplateRef: Maybe<Scalars['String']>;
};

export type PrivateCampaign = Campaign & {
  __typename?: 'PrivateCampaign';
  /** Action Pages of this campaign that are accessible to current user */
  actionPages: Array<PrivateActionPage>;
  /** Fetch public actions */
  actions: PublicActionsResult;
  /** Custom config map */
  config: Scalars['Json'];
  /** Schema for contact personal information */
  contactSchema: ContactSchema;
  /** External ID (if set) */
  externalId: Maybe<Scalars['Int']>;
  /** Campaign onwer collects opt-out actions for delivery even if campaign partner is */
  forceDelivery: Scalars['Boolean'];
  /** Campaign id */
  id: Scalars['Int'];
  /** MTT configuration */
  mtt: Maybe<CampaignMtt>;
  /** Internal name of the campaign */
  name: Scalars['String'];
  org: Org;
  /** List of partnerships and requests */
  partnerships: Maybe<Array<Partnership>>;
  /** Campaign statistics */
  stats: CampaignStats;
  targets: Maybe<Array<Maybe<Target>>>;
  /** Full, official name of the campaign */
  title: Scalars['String'];
};


export type PrivateCampaignActionsArgs = {
  actionType: Scalars['String'];
  limit: Scalars['Int'];
};

export type PrivateOrg = Org & {
  __typename?: 'PrivateOrg';
  /** Action Page */
  actionPage: ActionPage;
  /** List action pages this org has */
  actionPages: Array<ActionPage>;
  /** DEPRECATED: use campaign() in API root. Get campaign this org is leader or partner of by id */
  campaign: Campaign;
  /** List campaigns this org is leader or partner of */
  campaigns: Array<Campaign>;
  /** config */
  config: Scalars['Json'];
  /** Organization id */
  id: Scalars['Int'];
  key: Key;
  keys: Array<Key>;
  /** Organisation short name */
  name: Scalars['String'];
  /** Personal data settings for this org */
  personalData: PersonalData;
  processing: Processing;
  services: Array<Maybe<Service>>;
  /** Organisation title (human readable name) */
  title: Scalars['String'];
  users: Array<Maybe<OrgUser>>;
};


export type PrivateOrgActionPageArgs = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};


export type PrivateOrgActionPagesArgs = {
  select?: InputMaybe<SelectActionPage>;
};


export type PrivateOrgCampaignArgs = {
  id: Scalars['Int'];
};


export type PrivateOrgCampaignsArgs = {
  select?: InputMaybe<SelectCampaign>;
};


export type PrivateOrgKeyArgs = {
  select: SelectKey;
};


export type PrivateOrgKeysArgs = {
  select?: InputMaybe<SelectKey>;
};


export type PrivateOrgServicesArgs = {
  select?: InputMaybe<SelectService>;
};

export type PrivateTarget = Target & {
  __typename?: 'PrivateTarget';
  area: Maybe<Scalars['String']>;
  emails: Array<Maybe<TargetEmail>>;
  externalId: Scalars['String'];
  fields: Maybe<Scalars['Json']>;
  id: Scalars['String'];
  locale: Maybe<Scalars['String']>;
  name: Scalars['String'];
};

export type Processing = {
  __typename?: 'Processing';
  customActionConfirm: Scalars['Boolean'];
  customActionDeliver: Scalars['Boolean'];
  customEventDeliver: Scalars['Boolean'];
  customSupporterConfirm: Scalars['Boolean'];
  doiThankYou: Scalars['Boolean'];
  emailBackend: Maybe<ServiceName>;
  emailFrom: Maybe<Scalars['String']>;
  emailTemplates: Maybe<Array<Scalars['String']>>;
  eventBackend: Maybe<ServiceName>;
  eventProcessing: Scalars['Boolean'];
  sqsDeliver: Scalars['Boolean'];
  supporterConfirm: Scalars['Boolean'];
  supporterConfirmTemplate: Maybe<Scalars['String']>;
};

export type PublicActionPage = ActionPage & {
  __typename?: 'PublicActionPage';
  /** Campaign this action page belongs to. */
  campaign: Campaign;
  /** Config JSON of this action page */
  config: Scalars['Json'];
  id: Scalars['Int'];
  /** List of steps in journey (DEPRECATED: moved under config) */
  journey: Array<Scalars['String']>;
  /** Is live? */
  live: Scalars['Boolean'];
  /** Locale for the widget, in i18n format */
  locale: Scalars['String'];
  /** Name where the widget is hosted */
  name: Scalars['String'];
  /** Org the action page belongs to */
  org: Org;
  /** Thank you email templated of this Action Page */
  thankYouTemplate: Maybe<Scalars['String']>;
  /** A reference to thank you email template of this ActionPage */
  thankYouTemplateRef: Maybe<Scalars['String']>;
};

/** Result of actions query */
export type PublicActionsResult = {
  __typename?: 'PublicActionsResult';
  fieldKeys: Maybe<Array<Scalars['String']>>;
  list: Maybe<Array<Maybe<ActionCustomFields>>>;
};

export type PublicCampaign = Campaign & {
  __typename?: 'PublicCampaign';
  /** Fetch public actions */
  actions: PublicActionsResult;
  /** Custom config map */
  config: Scalars['Json'];
  /** Schema for contact personal information */
  contactSchema: ContactSchema;
  /** External ID (if set) */
  externalId: Maybe<Scalars['Int']>;
  /** Campaign id */
  id: Scalars['Int'];
  /** Internal name of the campaign */
  name: Scalars['String'];
  org: Org;
  /** Campaign statistics */
  stats: CampaignStats;
  targets: Maybe<Array<Maybe<Target>>>;
  /** Full, official name of the campaign */
  title: Scalars['String'];
};


export type PublicCampaignActionsArgs = {
  actionType: Scalars['String'];
  limit: Scalars['Int'];
};

export type PublicOrg = Org & {
  __typename?: 'PublicOrg';
  /** config */
  config: Scalars['Json'];
  /** Organisation short name */
  name: Scalars['String'];
  /** Organisation title (human readable name) */
  title: Scalars['String'];
};

export type PublicTarget = Target & {
  __typename?: 'PublicTarget';
  area: Maybe<Scalars['String']>;
  externalId: Scalars['String'];
  fields: Maybe<Scalars['Json']>;
  id: Scalars['String'];
  locale: Maybe<Scalars['String']>;
  name: Scalars['String'];
};

export type RootMutationType = {
  __typename?: 'RootMutationType';
  /** Accept a confirm on behalf of organisation. */
  acceptOrgConfirm: ConfirmResult;
  /** Accept a confirm by user */
  acceptUserConfirm: ConfirmResult;
  /** A separate key activate operation, because you also need to add the key to receiving system before it is used */
  activateKey: ActivateKeyResult;
  /** Adds an action referencing contact data via contactRef */
  addAction: ContactReference;
  /** Adds an action with contact data */
  addActionContact: ContactReference;
  addActionPage: ActionPage;
  addCampaign: Campaign;
  addKey: Key;
  addOrg: Org;
  /** Add user to org by email */
  addOrgUser: ChangeUserStatus;
  /**
   * Create stripe object using Stripe key associated with action page owning org.
   * Pass any of paymentIntent, subscription, customer, price json params to be sent as-is to Stripe API. The result is a JSON returned by Stripe API or a GraphQL Error object.
   * If you provide customer along payment intent or subscription, it will be first created, then their id will be added to params for the payment intent or subscription, so you can pack 2 Stripe API calls into one. You can do the same with price object in case of a subscription.
   */
  addStripeObject: Scalars['Json'];
  addStripePaymentIntent: Scalars['Json'];
  addStripeSubscription: Scalars['Json'];
  /**
   * Adds a new Action Page based on another Action Page. Intended to be used to
   * create a partner action page based off lead's one. Copies: campaign, locale, config, delivery flag
   */
  copyActionPage: ActionPage;
  /**
   * Adds a new Action Page based on latest Action Page from campaign. Intended to be used to
   * create a partner action page based off lead's one. Copies: campaign, locale, config, delivery flag
   */
  copyCampaignActionPage: ActionPage;
  deleteActionPage: Status;
  deleteCampaign: Status;
  deleteOrg: Status;
  deleteOrgUser: Maybe<DeleteUserResult>;
  generateKey: KeyWithPrivate;
  /** Invite an user to org by email (can be not yet user!) */
  inviteOrgUser: Confirm;
  joinOrg: JoinOrgResult;
  launchActionPage: LaunchActionPageResult;
  /** Link actions with refs to contact with contact reference */
  linkActions: ContactReference;
  /** Reject a confirm on behalf of organisation. */
  rejectOrgConfirm: ConfirmResult;
  /** Reject a confirm by user */
  rejectUserConfirm: ConfirmResult;
  resetApiToken: Scalars['String'];
  /** Update an Action Page */
  updateActionPage: ActionPage;
  updateCampaign: Campaign;
  updateOrg: PrivateOrg;
  /** Update org processing settings */
  updateOrgProcessing: PrivateOrg;
  updateOrgUser: ChangeUserStatus;
  /** Update (current) user details */
  updateUser: User;
  /**
   * Upserts a campaign.
   *
   * Creates or appends campaign and it's action pages. In case of append, it
   * will change the campaign with the matching name, and action pages with
   * matching names. It will create new action pages if you pass new names. No
   * Action Pages will be removed (principle of not removing signature data).
   */
  upsertCampaign: Campaign;
  upsertService: Service;
  upsertTargets: Array<Maybe<PrivateTarget>>;
  upsertTemplate: Maybe<Status>;
};


export type RootMutationTypeAcceptOrgConfirmArgs = {
  confirm: ConfirmInput;
  name: Scalars['String'];
};


export type RootMutationTypeAcceptUserConfirmArgs = {
  confirm: ConfirmInput;
};


export type RootMutationTypeActivateKeyArgs = {
  id: Scalars['Int'];
  orgName: Scalars['String'];
};


export type RootMutationTypeAddActionArgs = {
  action: ActionInput;
  actionPageId: Scalars['Int'];
  contactRef: Scalars['ID'];
  tracking?: InputMaybe<TrackingInput>;
};


export type RootMutationTypeAddActionContactArgs = {
  action: ActionInput;
  actionPageId: Scalars['Int'];
  contact: ContactInput;
  contactRef?: InputMaybe<Scalars['ID']>;
  privacy: ConsentInput;
  tracking?: InputMaybe<TrackingInput>;
};


export type RootMutationTypeAddActionPageArgs = {
  campaignName: Scalars['String'];
  input: ActionPageInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeAddCampaignArgs = {
  input: CampaignInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeAddKeyArgs = {
  input: AddKeyInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeAddOrgArgs = {
  input: OrgInput;
};


export type RootMutationTypeAddOrgUserArgs = {
  input: OrgUserInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeAddStripeObjectArgs = {
  actionPageId: Scalars['Int'];
  customer?: InputMaybe<Scalars['Json']>;
  paymentIntent?: InputMaybe<Scalars['Json']>;
  price?: InputMaybe<Scalars['Json']>;
  subscription?: InputMaybe<Scalars['Json']>;
  testing?: InputMaybe<Scalars['Boolean']>;
};


export type RootMutationTypeAddStripePaymentIntentArgs = {
  actionPageId: Scalars['Int'];
  contactRef?: InputMaybe<Scalars['ID']>;
  input: StripePaymentIntentInput;
  testing?: InputMaybe<Scalars['Boolean']>;
};


export type RootMutationTypeAddStripeSubscriptionArgs = {
  actionPageId: Scalars['Int'];
  contactRef?: InputMaybe<Scalars['ID']>;
  input: StripeSubscriptionInput;
  testing?: InputMaybe<Scalars['Boolean']>;
};


export type RootMutationTypeCopyActionPageArgs = {
  fromName: Scalars['String'];
  name: Scalars['String'];
  orgName: Scalars['String'];
};


export type RootMutationTypeCopyCampaignActionPageArgs = {
  fromCampaignName: Scalars['String'];
  name: Scalars['String'];
  orgName: Scalars['String'];
};


export type RootMutationTypeDeleteActionPageArgs = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};


export type RootMutationTypeDeleteCampaignArgs = {
  externalId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};


export type RootMutationTypeDeleteOrgArgs = {
  name: Scalars['String'];
};


export type RootMutationTypeDeleteOrgUserArgs = {
  email: Scalars['String'];
  orgName: Scalars['String'];
};


export type RootMutationTypeGenerateKeyArgs = {
  input: GenKeyInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeInviteOrgUserArgs = {
  input: OrgUserInput;
  message?: InputMaybe<Scalars['String']>;
  orgName: Scalars['String'];
};


export type RootMutationTypeJoinOrgArgs = {
  name: Scalars['String'];
};


export type RootMutationTypeLaunchActionPageArgs = {
  message?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
};


export type RootMutationTypeLinkActionsArgs = {
  actionPageId: Scalars['Int'];
  contactRef: Scalars['ID'];
  linkRefs?: InputMaybe<Array<Scalars['String']>>;
};


export type RootMutationTypeRejectOrgConfirmArgs = {
  confirm: ConfirmInput;
  name: Scalars['String'];
};


export type RootMutationTypeRejectUserConfirmArgs = {
  confirm: ConfirmInput;
};


export type RootMutationTypeUpdateActionPageArgs = {
  id?: InputMaybe<Scalars['Int']>;
  input: ActionPageInput;
  name?: InputMaybe<Scalars['String']>;
};


export type RootMutationTypeUpdateCampaignArgs = {
  externalId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  input: CampaignInput;
  name?: InputMaybe<Scalars['String']>;
};


export type RootMutationTypeUpdateOrgArgs = {
  input: OrgInput;
  name: Scalars['String'];
};


export type RootMutationTypeUpdateOrgProcessingArgs = {
  customActionConfirm?: InputMaybe<Scalars['Boolean']>;
  customActionDeliver?: InputMaybe<Scalars['Boolean']>;
  customEventDeliver?: InputMaybe<Scalars['Boolean']>;
  customSupporterConfirm?: InputMaybe<Scalars['Boolean']>;
  doiThankYou?: InputMaybe<Scalars['Boolean']>;
  emailBackend?: InputMaybe<ServiceName>;
  emailFrom?: InputMaybe<Scalars['String']>;
  eventBackend?: InputMaybe<ServiceName>;
  eventProcessing?: InputMaybe<Scalars['Boolean']>;
  name: Scalars['String'];
  sqsDeliver?: InputMaybe<Scalars['Boolean']>;
  supporterConfirm?: InputMaybe<Scalars['Boolean']>;
  supporterConfirmTemplate?: InputMaybe<Scalars['String']>;
};


export type RootMutationTypeUpdateOrgUserArgs = {
  input: OrgUserInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeUpdateUserArgs = {
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  input: UserDetailsInput;
};


export type RootMutationTypeUpsertCampaignArgs = {
  input: CampaignInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeUpsertServiceArgs = {
  id?: InputMaybe<Scalars['Int']>;
  input: ServiceInput;
  orgName: Scalars['String'];
};


export type RootMutationTypeUpsertTargetsArgs = {
  campaignId: Scalars['Int'];
  replace?: InputMaybe<Scalars['Boolean']>;
  targets: Array<TargetInput>;
};


export type RootMutationTypeUpsertTemplateArgs = {
  input: EmailTemplateInput;
  orgName: Scalars['String'];
};

export type RootQueryType = {
  __typename?: 'RootQueryType';
  /** Get action page */
  actionPage: ActionPage;
  /** Get campaign */
  campaign: Maybe<Campaign>;
  /** Get a list of campains */
  campaigns: Array<Campaign>;
  currentUser: User;
  exportActions: Array<Maybe<Action>>;
  /** Organization api (authenticated) */
  org: PrivateOrg;
  /** Select users from this instnace. Requires a manage users admin permission. */
  users: Array<User>;
};


export type RootQueryTypeActionPageArgs = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  url?: InputMaybe<Scalars['String']>;
};


export type RootQueryTypeCampaignArgs = {
  externalId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};


export type RootQueryTypeCampaignsArgs = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
};


export type RootQueryTypeExportActionsArgs = {
  after?: InputMaybe<Scalars['DateTime']>;
  campaignId?: InputMaybe<Scalars['Int']>;
  campaignName?: InputMaybe<Scalars['String']>;
  includeTesting?: InputMaybe<Scalars['Boolean']>;
  limit?: InputMaybe<Scalars['Int']>;
  onlyDoubleOptIn?: InputMaybe<Scalars['Boolean']>;
  onlyOptIn?: InputMaybe<Scalars['Boolean']>;
  orgName: Scalars['String'];
  start?: InputMaybe<Scalars['Int']>;
};


export type RootQueryTypeOrgArgs = {
  name: Scalars['String'];
};


export type RootQueryTypeUsersArgs = {
  select?: InputMaybe<SelectUser>;
};

export type RootSubscriptionType = {
  __typename?: 'RootSubscriptionType';
  actionPageUpserted: ActionPage;
};


export type RootSubscriptionTypeActionPageUpsertedArgs = {
  orgName?: InputMaybe<Scalars['String']>;
};

export type SelectActionPage = {
  campaignId?: InputMaybe<Scalars['Int']>;
};

export type SelectCampaign = {
  orgName?: InputMaybe<Scalars['String']>;
  titleLike?: InputMaybe<Scalars['String']>;
};

export type SelectKey = {
  active?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['Int']>;
  public?: InputMaybe<Scalars['String']>;
};

export type SelectService = {
  name?: InputMaybe<ServiceName>;
};

/** Criteria to filter users */
export type SelectUser = {
  /** Use % as wildcard */
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  /** Exact org name */
  orgName?: InputMaybe<Scalars['String']>;
};

export type Service = {
  __typename?: 'Service';
  host: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  name: ServiceName;
  path: Maybe<Scalars['String']>;
  user: Maybe<Scalars['String']>;
};

export type ServiceInput = {
  host?: InputMaybe<Scalars['String']>;
  name: ServiceName;
  password?: InputMaybe<Scalars['String']>;
  path?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Scalars['String']>;
};

export enum ServiceName {
  Mailjet = 'MAILJET',
  Ses = 'SES',
  Sqs = 'SQS',
  Stripe = 'STRIPE',
  TestStripe = 'TEST_STRIPE',
  Webhook = 'WEBHOOK',
  Wordpress = 'WORDPRESS'
}

export enum Status {
  /** Operation awaiting confirmation */
  Confirming = 'CONFIRMING',
  /** Operation had no effect (already done) */
  Noop = 'NOOP',
  /** Operation completed succesfully */
  Success = 'SUCCESS'
}

export type StripePaymentIntentInput = {
  amount: Scalars['Int'];
  currency: Scalars['String'];
  paymentMethodTypes?: InputMaybe<Array<Scalars['String']>>;
};

export type StripeSubscriptionInput = {
  amount: Scalars['Int'];
  currency: Scalars['String'];
  frequencyUnit: DonationFrequencyUnit;
};

export type Target = {
  area: Maybe<Scalars['String']>;
  externalId: Scalars['String'];
  fields: Maybe<Scalars['Json']>;
  id: Scalars['String'];
  locale: Maybe<Scalars['String']>;
  name: Scalars['String'];
};

export type TargetEmail = {
  __typename?: 'TargetEmail';
  email: Scalars['String'];
  emailStatus: EmailStatus;
  error: Maybe<Scalars['String']>;
};

export type TargetEmailInput = {
  email: Scalars['String'];
};

export type TargetInput = {
  area?: InputMaybe<Scalars['String']>;
  emails?: InputMaybe<Array<TargetEmailInput>>;
  externalId: Scalars['String'];
  fields?: InputMaybe<Scalars['Json']>;
  locale?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
};

/** Tracking codes */
export type Tracking = {
  __typename?: 'Tracking';
  campaign: Scalars['String'];
  content: Scalars['String'];
  medium: Scalars['String'];
  source: Scalars['String'];
};

/** Tracking codes */
export type TrackingInput = {
  campaign: Scalars['String'];
  content?: InputMaybe<Scalars['String']>;
  /** Action page location. Url from which action is added. Must contain schema, domain, (port), pathname */
  location?: InputMaybe<Scalars['String']>;
  medium: Scalars['String'];
  source: Scalars['String'];
};

export type User = {
  __typename?: 'User';
  apiToken: Maybe<ApiToken>;
  email: Scalars['String'];
  id: Scalars['Int'];
  isAdmin: Scalars['Boolean'];
  jobTitle: Maybe<Scalars['String']>;
  phone: Maybe<Scalars['String']>;
  pictureUrl: Maybe<Scalars['String']>;
  roles: Array<UserRole>;
};

export type UserDetailsInput = {
  jobTitle?: InputMaybe<Scalars['String']>;
  phone?: InputMaybe<Scalars['String']>;
  pictureUrl?: InputMaybe<Scalars['String']>;
};

export type UserRole = {
  __typename?: 'UserRole';
  org: Org;
  role: Scalars['String'];
};


export const UserOrgsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserOrgs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"roles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"org"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrivateOrg"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<UserOrgs, UserOrgsVariables>;
export type UserOrgsVariables = Exact<{ [key: string]: never; }>;


export type UserOrgs = { __typename?: 'RootQueryType', currentUser: { __typename?: 'User', roles: Array<{ __typename?: 'UserRole', org: { __typename: 'PrivateOrg', id: number, name: string } | { __typename: 'PublicOrg', name: string } }> } };


export type ObjectFieldTypes = {
    [key: string]: { [key: string]: string | string[] }
};

export type OpTypes = {
    [key: string]: string | string[]
};

export type ScalarLocations = {
 scalars: string[],
 inputObjectFieldTypes: ObjectFieldTypes;
 outputObjectFieldTypes: ObjectFieldTypes;
 operationMap: OpTypes;
};

export const scalarLocations : ScalarLocations = {
  "inputObjectFieldTypes": {
    "ActionInput": {
      "customFields": "Json",
      "donation": "DonationActionInput",
      "fields": "CustomFieldInput",
      "mtt": "MttActionInput"
    },
    "ActionPageInput": {
      "config": "Json"
    },
    "CampaignInput": {
      "actionPages": "ActionPageInput",
      "config": "Json",
      "mtt": "CampaignMttInput"
    },
    "ContactInput": {
      "address": "AddressInput",
      "nationality": "NationalityInput"
    },
    "DonationActionInput": {
      "payload": "Json"
    },
    "OrgInput": {
      "config": "Json"
    },
    "TargetInput": {
      "emails": "TargetEmailInput",
      "fields": "Json"
    }
  },
  "outputObjectFieldTypes": {
    "Action": {
      "actionPage": [
        "PrivateActionPage",
        "PublicActionPage"
      ],
      "campaign": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "contact": "Contact",
      "customFields": "Json",
      "donation": "Donation",
      "fields": "CustomField",
      "privacy": "Consent",
      "tracking": "Tracking"
    },
    "ActionCustomFields": {
      "customFields": "Json",
      "fields": "CustomField"
    },
    "CampaignStats": {
      "actionCount": "ActionTypeCount",
      "supporterCountByArea": "AreaCount",
      "supporterCountByOrg": "OrgCount"
    },
    "Confirm": {
      "creator": "User"
    },
    "ConfirmResult": {
      "actionPage": [
        "PrivateActionPage",
        "PublicActionPage"
      ],
      "campaign": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "Contact": {
      "publicKey": "KeyIds",
      "signKey": "KeyIds"
    },
    "Donation": {
      "payload": "Json"
    },
    "JoinOrgResult": {
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "OrgCount": {
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "Partnership": {
      "actionPages": [
        "PrivateActionPage",
        "PublicActionPage"
      ],
      "launchRequesters": "User",
      "launchRequests": "Confirm",
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "PrivateActionPage": {
      "campaign": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "config": "Json",
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "PrivateCampaign": {
      "actionPages": "PrivateActionPage",
      "actions": "PublicActionsResult",
      "config": "Json",
      "mtt": "CampaignMtt",
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ],
      "partnerships": "Partnership",
      "stats": "CampaignStats",
      "targets": [
        "PrivateTarget",
        "PublicTarget"
      ]
    },
    "PrivateOrg": {
      "actionPage": [
        "PrivateActionPage",
        "PublicActionPage"
      ],
      "actionPages": [
        "PrivateActionPage",
        "PublicActionPage"
      ],
      "campaign": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "campaigns": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "config": "Json",
      "key": "Key",
      "keys": "Key",
      "personalData": "PersonalData",
      "processing": "Processing",
      "services": "Service",
      "users": "OrgUser"
    },
    "PrivateTarget": {
      "emails": "TargetEmail",
      "fields": "Json"
    },
    "PublicActionPage": {
      "campaign": [
        "PrivateCampaign",
        "PublicCampaign"
      ],
      "config": "Json",
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    },
    "PublicActionsResult": {
      "list": "ActionCustomFields"
    },
    "PublicCampaign": {
      "actions": "PublicActionsResult",
      "config": "Json",
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ],
      "stats": "CampaignStats",
      "targets": [
        "PrivateTarget",
        "PublicTarget"
      ]
    },
    "PublicOrg": {
      "config": "Json"
    },
    "PublicTarget": {
      "fields": "Json"
    },
    "User": {
      "apiToken": "ApiToken",
      "roles": "UserRole"
    },
    "UserRole": {
      "org": [
        "PrivateOrg",
        "PublicOrg"
      ]
    }
  },
  "operationMap": {
    "acceptOrgConfirm": "ConfirmResult",
    "acceptUserConfirm": "ConfirmResult",
    "activateKey": "ActivateKeyResult",
    "addAction": "ContactReference",
    "addActionContact": "ContactReference",
    "addActionPage": [
      "PrivateActionPage",
      "PublicActionPage"
    ],
    "addCampaign": [
      "PrivateCampaign",
      "PublicCampaign"
    ],
    "addKey": "Key",
    "addOrg": [
      "PrivateOrg",
      "PublicOrg"
    ],
    "addOrgUser": "ChangeUserStatus",
    "addStripeObject": "Json",
    "addStripePaymentIntent": "Json",
    "addStripeSubscription": "Json",
    "copyActionPage": [
      "PrivateActionPage",
      "PublicActionPage"
    ],
    "copyCampaignActionPage": [
      "PrivateActionPage",
      "PublicActionPage"
    ],
    "deleteOrgUser": "DeleteUserResult",
    "generateKey": "KeyWithPrivate",
    "inviteOrgUser": "Confirm",
    "joinOrg": "JoinOrgResult",
    "launchActionPage": "LaunchActionPageResult",
    "linkActions": "ContactReference",
    "rejectOrgConfirm": "ConfirmResult",
    "rejectUserConfirm": "ConfirmResult",
    "updateActionPage": [
      "PrivateActionPage",
      "PublicActionPage"
    ],
    "updateCampaign": [
      "PrivateCampaign",
      "PublicCampaign"
    ],
    "updateOrg": "PrivateOrg",
    "updateOrgProcessing": "PrivateOrg",
    "updateOrgUser": "ChangeUserStatus",
    "updateUser": "User",
    "upsertCampaign": [
      "PrivateCampaign",
      "PublicCampaign"
    ],
    "upsertService": "Service",
    "upsertTargets": "PrivateTarget",
    "actionPage": [
      "PrivateActionPage",
      "PublicActionPage"
    ],
    "campaign": [
      "PrivateCampaign",
      "PublicCampaign"
    ],
    "campaigns": [
      "PrivateCampaign",
      "PublicCampaign"
    ],
    "currentUser": "User",
    "exportActions": "Action",
    "org": "PrivateOrg",
    "users": "User",
    "actionPageUpserted": [
      "PrivateActionPage",
      "PublicActionPage"
    ]
  },
  "scalars": [
    "Json"
  ]
};
