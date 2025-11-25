import z from "zod";

export const ClientSchema = z.object({
    orgUnit: z.string().optional(),
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
        z.object({ compulsory: z.boolean(), id: z.string() }),
    ),
    id: z.string(),
    repeatable: z.boolean(),
    programStageSections: z.array(ProgramStageSectionSchema),
});

export const TrackedEntityAttributeSchema = z.object({
    sortOrder: z.number(),
    mandatory: z.boolean(),
    id: z.string(),
    trackedEntityAttribute: z.object({
        name: z.string(),
        valueType: z.string(),
        optionSet: OptionSetSchema.optional(),
        confidential: z.boolean(),
        unique: z.boolean(),
        generated: z.boolean(),
        pattern: z.string(),
        optionSetValue: z.boolean(),
        displayFormName: z.string(),
        id: z.string(),
    }),
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
    programTrackedEntityAttributes: z.array(TrackedEntityAttributeSchema),
});

export const ProgramRuleActionSchema = z.object({
    programRuleActionType: z.enum([
        "HIDEFIELD",
        "SHOWFIELD",
        "ASSIGN",
        "DISPLAYTEXT",
        "ERROR",
        "SHOWWARNING",
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
    dataElement: z.object({ id: z.string() }),
    useCodeForOptionSet: z.boolean(),
    displayName: z.string(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
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

export const TrackedEntitySchema = z.object({
    trackedEntity: z.string(),
    trackedEntityType: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    orgUnit: z.string(),
    inactive: z.boolean(),
    deleted: z.boolean(),
    potentialDuplicate: z.boolean(),
    createdBy: z.object({
        uid: z.string(),
        username: z.string(),
        firstName: z.string(),
        surname: z.string(),
    }),
    updatedBy: z.object({
        uid: z.string(),
        username: z.string(),
        firstName: z.string(),
        surname: z.string(),
    }),
    attributes: z.array(
        z.object({
            attribute: z.string(),
            displayName: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
            valueType: z.string(),
            value: z.string(),
        }),
    ),
    createdAtClient: z.string(),
});

export const TrackedEntityResponseSchema = z.object({
    pager: z.object({
        page: z.number(),
        pageSize: z.number(),
        nextPage: z.string(),
    }),
    trackedEntities: z.array(TrackedEntitySchema),
});

export type Client = z.infer<typeof ClientSchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type ProgramStage = z.infer<typeof ProgramStageSchema>;
export type ProgramStageSection = z.infer<typeof ProgramStageSectionSchema>;
export type DataElement = z.infer<typeof DataElementSchema>;
export type TrackedEntityAttribute = z.infer<
    typeof TrackedEntityAttributeSchema
>;
export type OptionSet = z.infer<typeof OptionSetSchema>;
export type ProgramRule = z.infer<typeof ProgramRuleSchema>;
export type ProgramRuleAction = z.infer<typeof ProgramRuleActionSchema>;
export type ProgramRuleVariable = z.infer<typeof ProgramRuleVariableSchema>;
export type OrgUnit = z.infer<typeof OrgUnitSchema>;
export type TrackedEntity = z.infer<typeof TrackedEntitySchema>;
export type TrackedEntityResponse = z.infer<typeof TrackedEntityResponseSchema>;
