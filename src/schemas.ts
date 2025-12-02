import { TablePaginationConfig } from "antd";
import { FilterValue } from "antd/es/table/interface";
import z from "zod";

export const UserSchema = z.object({
    uid: z.string(),
    username: z.string(),
    firstName: z.string(),
    surname: z.string(),
});

export const ClientSchema = z.object({
    orgUnits: z.string().optional(),
});

export const OptionSetSchema = z.object({
    name: z.string(),
    options: z.array(
        z.object({
            code: z.string(),
            name: z.string(),
            id: z.string(),
        }),
    ),
    id: z.string(),
});

export const DataElementSchema = z.object({
    code: z.string(),
    name: z.string(),
    optionSet: OptionSetSchema.optional(),
    optionSetValue: z.boolean(),
    valueType: z.string(),
    formName: z.string(),
    id: z.string(),
});

export const ProgramStageSectionSchema = z.object({
    name: z.string(),
    dataElements: z.array(DataElementSchema),
    sortOrder: z.number(),
    displayName: z.string(),
    id: z.string(),
});

export const ProgramStageSchema = z.object({
    name: z.string(),
    programStageDataElements: z.array(
        z.object({
            compulsory: z.boolean(),
            id: z.string(),
            allowFutureDate: z.boolean(),
            dataElement: DataElementSchema,
            renderType: z
                .object({
                    MOBILE: z.object({ type: z.string() }),
                    DESKTOP: z.object({ type: z.string() }),
                })
                .optional(),
        }),
    ),
    id: z.string(),
    repeatable: z.boolean(),
    programStageSections: z.array(ProgramStageSectionSchema),
});

export const TrackedEntityAttributeSchema = z.object({
    name: z.string(),
    valueType: z.string(),
    optionSet: OptionSetSchema.optional(),
    confidential: z.boolean(),
    unique: z.boolean(),
    generated: z.boolean(),
    pattern: z.string(),
    optionSetValue: z.boolean(),
    displayFormName: z.string(),
		formName: z.string().optional(),
    id: z.string(),
});

export const ProgramTrackedEntityAttributeSchema = z.object({
    sortOrder: z.number(),
    mandatory: z.boolean(),
    id: z.string(),
    displayInList: z.boolean(),
    trackedEntityAttribute: TrackedEntityAttributeSchema,
});

export const ProgramSchema = z.object({
    name: z.string(),
    programType: z.string(),
    selectEnrollmentDatesInFuture: z.boolean(),
    selectIncidentDatesInFuture: z.boolean(),
    trackedEntityType: z.object({ featureType: z.string(), id: z.string() }),
    id: z.string(),
    organisationUnits: z.array(z.object({ id: z.string() })),
    programStages: z.array(ProgramStageSchema),
    programTrackedEntityAttributes: z.array(
        ProgramTrackedEntityAttributeSchema,
    ),
});

export const ProgramRuleActionSchema = z.object({
    programRuleActionType: z.enum([
        "HIDEFIELD",
        "SHOWFIELD",
        "ASSIGN",
        "DISPLAYTEXT",
        "ERROR",
        "SHOWWARNING",
        "HIDESECTION",
        "SHOWSECTION",
        "HIDEOPTION",
        "SHOWOPTION",
        "HIDEOPTIONGROUP",
        "SHOWOPTIONGROUP",
    ]),
    dataElement: z
        .object({ displayName: z.string(), id: z.string() })
        .optional(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
    templateUid: z.string().optional(),
    option: z.object({ id: z.string(), displayName: z.string() }).optional(),
    optionGroup: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    trackedEntityAttribute: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    programStage: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    programStageSection: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    value: z.string().optional(),
    displayContent: z.string().optional(),
    content: z.string().optional(),
});

export const ProgramRuleSchema = z.object({
    name: z.string(),
    translations: z.array(z.unknown()),
    description: z.string(),
    programRuleActions: z.array(ProgramRuleActionSchema),
    condition: z.string(),
    priority: z.number(),
    displayName: z.string(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
});

export const ProgramRuleVariableSchema = z.object({
    name: z.string(),
    program: z.object({ id: z.string() }),
    dataElement: z.object({ id: z.string() }).optional(),
    useCodeForOptionSet: z.boolean(),
    displayName: z.string(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
    trackedEntityAttribute: z.object({ id: z.string() }).optional(),
    programRuleVariableSourceType: z.string(),
    valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE"]),
});

export const OrgUnitSchema = z.object({
    id: z.string(),
    name: z.string(),
    level: z.number(),
    parent: z.object({ id: z.string() }).optional(),
    leaf: z.boolean(),
});

export const AttributeSchema = z.object({
    attribute: z.string(),
    displayName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    valueType: z.string(),
    value: z.string(),
});

export const DataValueSchema = z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    storedBy: z.string(),
    providedElsewhere: z.boolean(),
    dataElement: z.string(),
    value: z.string(),
    createdBy: UserSchema,
    updatedBy: UserSchema,
});

export const EventSchema = z.object({
    event: z.string(),
    status: z.string(),
    program: z.string(),
    programStage: z.string(),
    enrollment: z.string(),
    trackedEntity: z.string(),
    orgUnit: z.string(),
    relationships: z.array(z.unknown()).optional(),
    occurredAt: z.string(),
    followUp: z.boolean(),
    deleted: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    attributeOptionCombo: z.string().optional(),
    attributeCategoryOptions: z.string().optional(),
    completedBy: z.string().optional(),
    completedAt: z.string().optional(),
    createdBy: UserSchema.optional(),
    updatedBy: UserSchema.optional(),
    dataValues: z.array(DataValueSchema),
    notes: z.array(z.unknown()).optional(),
});

export const EnrollmentsSchema = z.object({
    enrollment: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    trackedEntity: z.string(),
    program: z.string(),
    status: z.string(),
    orgUnit: z.string(),
    enrolledAt: z.string(),
    occurredAt: z.string(),
    followUp: z.boolean(),
    deleted: z.boolean(),
    createdBy: UserSchema.optional(),
    updatedBy: UserSchema.optional(),
    events: z.array(EventSchema),
    relationships: z.array(z.unknown()).optional(),
    attributes: z.array(AttributeSchema),
    notes: z.array(z.unknown()).optional(),
});

export const TrackedEntitySchema = z.object({
    trackedEntity: z.string(),
    trackedEntityType: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    orgUnit: z.string(),
    inactive: z.boolean(),
    deleted: z.boolean(),
    potentialDuplicate: z.boolean(),
    createdBy: UserSchema.optional(),
    updatedBy: UserSchema.optional(),
    attributes: z.array(AttributeSchema),
    createdAtClient: z.string(),
    enrollments: z.array(EnrollmentsSchema),
    programOwners: z
        .array(
            z.object({
                orgUnit: z.string(),
                trackedEntity: z.string(),
                program: z.string(),
            }),
        )
        .optional(),
});

export const TrackedEntityResponseSchema = z.object({
    pager: z.object({
        page: z.number(),
        pageSize: z.number(),
        nextPage: z.string(),
        total: z.number(),
    }),
    trackedEntities: z.array(TrackedEntitySchema),
});

export const EventResponseSchema = z.object({
    pager: z.object({
        page: z.number(),
        pageSize: z.number(),
        nextPage: z.string(),
        total: z.number(),
    }),
    events: z.array(EventSchema),
});

export type Client = z.infer<typeof ClientSchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type ProgramStage = z.infer<typeof ProgramStageSchema>;
export type ProgramStageSection = z.infer<typeof ProgramStageSectionSchema>;
export type DataElement = z.infer<typeof DataElementSchema>;
export type ProgramTrackedEntityAttribute = z.infer<
    typeof ProgramTrackedEntityAttributeSchema
>;
export type OptionSet = z.infer<typeof OptionSetSchema>;
export type ProgramRule = z.infer<typeof ProgramRuleSchema>;
export type ProgramRuleAction = z.infer<typeof ProgramRuleActionSchema>;
export type ProgramRuleVariable = z.infer<typeof ProgramRuleVariableSchema>;
export type OrgUnit = z.infer<typeof OrgUnitSchema>;
export type TrackedEntity = z.infer<typeof TrackedEntitySchema>;
export type TrackedEntityResponse = z.infer<typeof TrackedEntityResponseSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Enrollment = z.infer<typeof EnrollmentsSchema>;
export type DataValue = z.infer<typeof DataValueSchema>;
export type Attribute = z.infer<typeof AttributeSchema>;
export type User = z.infer<typeof UserSchema>;
export type TrackedEntityAttribute = z.infer<
    typeof TrackedEntityAttributeSchema
>;
export type EventResponse = z.infer<typeof EventResponseSchema>;

export type Message = {
    key: string;
    content: string;
};

export type ProgramRuleResult = {
    assignments: Record<string, any>;
    hiddenFields: Set<string>;
    shownFields: Set<string>;
    hiddenSections: Set<string>;
    shownSections: Set<string>;
    messages: Array<Message>;
    warnings: Array<Message>;
    errors: Array<Message>;
    hiddenOptions: Record<string, Set<string>>;
    shownOptions: Record<string, Set<string>>;
    hiddenOptionGroups: Record<string, Set<string>>;
    shownOptionGroups: Record<string, Set<string>>;
};

export type OnChange = {
    pagination: TablePaginationConfig;
    filters: Record<string, FilterValue | null>;
};
