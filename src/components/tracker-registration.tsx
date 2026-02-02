import {
	CheckCircleOutlined,
	ExclamationCircleOutlined,
	UserAddOutlined,
} from "@ant-design/icons";
import {
	Button,
	Card,
	Flex,
	Form,
	message,
	Modal,
	Row,
	Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useCallback, useMemo, useState } from "react";
import { db, FlattenedRelationship, FlattenedTrackedEntity } from "../db";
import { useDexiePersistence } from "../hooks/useDexiePersistence";
import { useEntitySyncStatus } from "../hooks/useEntitySyncStatus";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { useTrackerFormInit } from "../hooks/useTrackerFormInit";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { RenderType } from "../schemas";
import { generateUid } from "../utils/id";
import {
	calculateColSpan,
	createEmptyTrackedEntity,
	spans,
} from "../utils/utils";
import { DataElementField } from "./data-element-field";

const { Text } = Typography;

export interface TrackerRegistrationProps {
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isModalOpen: boolean;
    modalTitle?: string;
    submitButtonText?: string;
    onSuccess?: (trackedEntity: any) => void;
    parentTrackedEntity?: string;
    relationshipType?: string;
    initialAttributes?: Record<string, any>;
    autoPopulateFields?: string[];
    createNewEntity?: boolean;
    canAddAnother?: boolean;
}

export const TrackerRegistration: React.FC<TrackerRegistrationProps> = ({
    isModalOpen,
    setIsModalOpen,
    modalTitle = "Client Registration",
    submitButtonText = "Register Client",
    onSuccess,
    parentTrackedEntity,
    relationshipType,
    initialAttributes = {},
    createNewEntity = false,
}) => {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRuleVariables,
        programRules,
    } = RootRoute.useLoaderData();

    const allAttributes: Map<
        string,
        {
            mandatory: boolean;
            desktopRenderType?: RenderType;
        }
    > = new Map(
        program.programTrackedEntityAttributes.map(
            ({ mandatory, renderType, trackedEntityAttribute: { id } }) => [
                id,
                {
                    mandatory,
                    desktopRenderType: renderType?.DESKTOP,
                },
            ],
        ),
    );

    const [form] = Form.useForm();
    const trackedEntityFromState = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );
    const orgUnit = TrackerContext.useSelector(
        (state) => state.context.orgUnit.id,
    );

    const trackerActor = TrackerContext.useActorRef();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [localTrackedEntityId, setLocalTrackedEntityId] =
        useState<string>("");

    // Track current enrollment for program rules (updated when ENROLLED_AT changes)
    const [currentEnrollment, setCurrentEnrollment] = useState<any>(null);

    const effectiveTrackedEntityId = createNewEntity
        ? localTrackedEntityId
        : trackedEntityFromState.trackedEntity || "";

    // Use unified persistence hook
    const {
        entity: trackedEntity,
        updateField,
        updateFields,
    } = useDexiePersistence<FlattenedTrackedEntity>({
        entityType: "trackedEntity",
        entityId: effectiveTrackedEntityId,
    });

    // Initialize and sync enrollment state from entity
    React.useEffect(() => {
        const enrollment =
            trackedEntity?.enrollment || trackedEntityFromState.enrollment;
        if (enrollment) {
            // Only update if enrollment hasn't been set yet, or if the entity enrollment changed
            // (but preserve any user-made changes to enrolledAt in the form)
            if (!currentEnrollment) {
                setCurrentEnrollment(enrollment);
            } else if (
                enrollment.enrollment !== currentEnrollment.enrollment ||
                enrollment.program !== currentEnrollment.program
            ) {
                // Entity changed (new enrollment entirely), update but preserve enrolledAt if user modified it
                setCurrentEnrollment({
                    ...enrollment,
                    enrolledAt: currentEnrollment.enrolledAt, // Preserve user's date changes
                    occurredAt: currentEnrollment.occurredAt,
                });
            }
        }
    }, [
        trackedEntity?.enrollment,
        trackedEntityFromState.enrollment,
        currentEnrollment,
    ]);

    // Use program rules with autoExecute enabled
    const { ruleResult, executeAndApplyRules, triggerAutoExecute } =
        useProgramRulesWithDexie({
            form,
            programRules,
            programRuleVariables,
            trackedEntityAttributes:
                trackedEntity?.attributes || trackedEntityFromState.attributes,
            enrollment:
                currentEnrollment ||
                trackedEntity?.enrollment ||
                trackedEntityFromState.enrollment,
            onAssignments: updateFields,
            applyAssignmentsToForm: true,
            persistAssignments: true,
            clearHiddenFields: true,
            program: program.id,
            isRegistration: true,
            autoExecute: true, // Enable automatic rule execution
        });
    // Wrap updateField to also trigger program rules
    const updateFieldWithRules = useCallback(
        (fieldId: string, value: any) => {
            // Special handling for registration/enrollment date changes
            // Both TRACKER_ID (Registration Date) and ENROLLED_AT update the enrollment date
            if (
                (fieldId === "TRACKER_ID" || fieldId === "ENROLLED_AT") &&
                currentEnrollment
            ) {
                const formattedDate = dayjs(value).format(
                    "YYYY-MM-DDTHH:mm:ss.SSSZ",
                );
                console.log("📅 Updating enrollment date for program rules:", {
                    field: fieldId,
                    rawValue: value,
                    formattedDate,
                    previousEnrolledAt: currentEnrollment.enrolledAt,
                });
                setCurrentEnrollment({
                    ...currentEnrollment,
                    enrolledAt: formattedDate,
                    occurredAt: formattedDate, // Also update occurredAt for consistency
                });
            }

            updateField(fieldId, value);
            triggerAutoExecute();
        },
        [updateField, triggerAutoExecute, currentEnrollment],
    );

    const { syncStatus, syncError } = useEntitySyncStatus(
        trackedEntity?.trackedEntity || null,
    );

    const fields = useMemo(() => {
        return Object.entries(trackedEntity?.attributes || {}).map(
            ([name, value]) => ({
                name,
                value,
            }),
        );
    }, [trackedEntity?.attributes]);

    // Create or load entity when modal opens
    const initializeEntity = useCallback(async () => {
        if (!isModalOpen) return null;

        let entityToUse = trackedEntityFromState;

        if (createNewEntity) {
            if (!localTrackedEntityId) {
                const newEntity = createEmptyTrackedEntity({ orgUnit });
                console.log("🆕 Creating new tracked entity:", newEntity.trackedEntity);
                setLocalTrackedEntityId(newEntity.trackedEntity);
                // Put in Dexie
                await db.trackedEntities.put({
                    ...newEntity,
                    syncStatus: "draft",
                    version: 1,
                    lastModified: new Date().toISOString(),
                } as any);
                console.log("✅ New tracked entity saved to Dexie");
                // Verify it was saved
                const saved = await db.trackedEntities.get(newEntity.trackedEntity);
                console.log("🔍 Verification - entity in Dexie:", saved ? "YES" : "NO");
                return newEntity;
            } else {
                console.log("📋 Loading existing entity:", localTrackedEntityId);
                const existingEntity =
                    await db.trackedEntities.get(localTrackedEntityId);
                if (existingEntity) {
                    console.log("✅ Existing entity loaded from Dexie");
                    return existingEntity;
                } else {
                    console.error("❌ Existing entity not found in Dexie:", localTrackedEntityId);
                }
            }
        } else if (!effectiveTrackedEntityId && entityToUse?.trackedEntity) {
            console.log("💾 Saving entity from state to Dexie:", entityToUse.trackedEntity);
            await db.trackedEntities.put({
                ...entityToUse,
                syncStatus: "draft",
                version: 1,
                lastModified: new Date().toISOString(),
            } as any);
        }

        return entityToUse;
    }, [
        isModalOpen,
        createNewEntity,
        localTrackedEntityId,
        orgUnit,
        trackedEntityFromState,
        effectiveTrackedEntityId,
    ]);

    // Initialize entity when modal opens
    React.useEffect(() => {
        if (!isModalOpen) {
            if (createNewEntity) {
                setLocalTrackedEntityId("");
            }
            return;
        }

        // Initialize entity when modal opens - this ensures the entity exists in Dexie
        const shouldInitialize =
            (createNewEntity && !localTrackedEntityId) ||
            (!createNewEntity && trackedEntityFromState?.trackedEntity);

        if (shouldInitialize) {
            initializeEntity();
        }
    }, [
        isModalOpen,
        createNewEntity,
        localTrackedEntityId,
        trackedEntityFromState?.trackedEntity,
        initializeEntity,
    ]);

    // Merge initial attributes with default enrollment date
    const initialValuesWithDefaults = useMemo(() => {
        const today = dayjs().format("YYYY-MM-DD");
        const enrolledAt = trackedEntity?.enrollment?.enrolledAt
            ? dayjs(trackedEntity.enrollment.enrolledAt).format("YYYY-MM-DD")
            : trackedEntityFromState?.enrollment?.enrolledAt
              ? dayjs(trackedEntityFromState.enrollment.enrolledAt).format(
                    "YYYY-MM-DD",
                )
              : today;

        return {
            TRACKER_ID: enrolledAt, // Registration date from enrollment or defaults to today
            ENROLLED_AT: enrolledAt, // Keep this for backward compatibility
            ...initialAttributes, // Allow overrides from props
        };
    }, [
        initialAttributes,
        trackedEntity?.enrollment?.enrolledAt,
        trackedEntityFromState?.enrollment?.enrolledAt,
    ]);

    // Use unified form initialization hook
    useTrackerFormInit({
        form,
        entity: createNewEntity ? null : trackedEntity,
        initialValues: initialValuesWithDefaults,
        executeRules: executeAndApplyRules,
        enabled: isModalOpen,
    });

    const onStageSubmit = async (values: any) => {
        if (ruleResult.errors.length > 0) {
            message.error({
                content: `Validation failed: ${ruleResult.errors.map((e) => e.content).join(", ")}`,
                duration: 5,
            });
            return;
        }
        try {
            setIsSubmitting(true);

            const finalValues = {
                ...values,
                ...ruleResult.assignments,
            };

            // Ensure entity exists before updating
            if (!effectiveTrackedEntityId) {
                throw new Error("No tracked entity ID available");
            }

            console.log("📝 Submitting with effectiveTrackedEntityId:", effectiveTrackedEntityId);
            console.log("📝 createNewEntity:", createNewEntity);
            console.log("📝 localTrackedEntityId:", localTrackedEntityId);

            // Verify entity exists in Dexie BEFORE updating
            const existingEntity = await db.trackedEntities.get(effectiveTrackedEntityId);
            console.log("🔍 Entity exists in Dexie before update:", existingEntity ? "YES" : "NO");
            if (!existingEntity) {
                console.error("❌ Entity not found before update. Creating it now...");
                // Try to recover by creating the entity
                const newEntity = createEmptyTrackedEntity({ orgUnit });
                await db.trackedEntities.put({
                    ...newEntity,
                    trackedEntity: effectiveTrackedEntityId,
                    enrollment: {
                        ...newEntity.enrollment,
                        trackedEntity: effectiveTrackedEntityId,
                    },
                    syncStatus: "draft",
                    version: 1,
                    lastModified: new Date().toISOString(),
                } as any);
                console.log("✅ Entity created during submit");
            }

            await updateFields(finalValues);

            // Verify entity was saved by checking Dexie directly
            const savedEntity = await db.trackedEntities.get(
                effectiveTrackedEntityId,
            );
            if (!savedEntity) {
                throw new Error("Failed to save patient to local database");
            }

            // Update enrollment enrolledAt from Registration Date (TRACKER_ID) or ENROLLED_AT
            const enrolledAt =
                finalValues.TRACKER_ID || finalValues.ENROLLED_AT;
            if (enrolledAt && savedEntity.enrollment) {
                const formattedEnrolledAt = dayjs(enrolledAt).format(
                    "YYYY-MM-DDTHH:mm:ss.SSSZ",
                );
                await db.trackedEntities.update(savedEntity.trackedEntity, {
                    enrollment: {
                        ...savedEntity.enrollment,
                        enrolledAt: formattedEnrolledAt,
                        occurredAt: formattedEnrolledAt,
                    },
                });
            }

            // Create relationship if this is a child registration
            if (parentTrackedEntity && relationshipType) {
                const relationship: FlattenedRelationship = {
                    relationship: generateUid(),
                    relationshipType,
                    from: {
                        id: parentTrackedEntity,
                        fields: {},
                    },
                    to: {
                        id: savedEntity.trackedEntity,
                        fields: {},
                    },
                    createdAt: dayjs().toISOString(),
                    lastSynced: dayjs().toISOString(),
                    updatedAt: dayjs().toISOString(),
                    version: 1,
                    syncStatus: "pending",
                    syncError: "",
                };
                await db.relationships.put(relationship);
            }

            // Mark as pending sync
            await db.trackedEntities.update(savedEntity.trackedEntity, {
                syncStatus: "pending",
            });

            // Re-fetch to get updated entity with pending status
            const finalEntity = await db.trackedEntities.get(
                savedEntity.trackedEntity,
            );
            if (!finalEntity) {
                throw new Error("Failed to verify patient save");
            }

            if (onSuccess) {
                onSuccess(finalEntity);
            } else {
                trackerActor.send({
                    type: "SET_TRACKED_ENTITY",
                    trackedEntity: finalEntity,
                });
            }

            message.success({
                content:
                    submitButtonText.replace(/^Register /, "") +
                    " registered successfully!",
                duration: 3,
            });

            setIsModalOpen(false);
            setIsSubmitting(false);
        } catch (error) {
            console.error("Error creating patient:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to register patient. Please try again.";
            message.error({
                content: errorMessage,
                duration: 5,
            });
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        try {
            await form.validateFields();
            form.submit();
        } catch (error) {
            console.error("Form validation failed:", error);
        }
    };
    return (
        <Modal
            open={isModalOpen}
            onCancel={() => {
                form.resetFields();
                setIsModalOpen(() => false);
            }}
            centered
            zIndex={1000}
            title={
                <Flex align="center" gap="middle">
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <UserAddOutlined style={{ fontSize: 20 }} />
                    </div>
                    <Text strong style={{ fontSize: 18, color: "#1f2937" }}>
                        {modalTitle}
                    </Text>
                </Flex>
            }
            width="85vw"
            footer={
                <Flex
                    justify="space-between"
                    align="center"
                    style={{ padding: "8px 0" }}
                >
                    {syncStatus && syncStatus !== "draft" && (
                        <Flex align="center" gap="small">
                            {syncStatus === "synced" && (
                                <>
                                    <CheckCircleOutlined
                                        style={{ color: "#52c41a" }}
                                    />
                                    <Text
                                        type="success"
                                        style={{ fontSize: 12 }}
                                    >
                                        Synced
                                    </Text>
                                </>
                            )}
                            {syncStatus === "pending" && (
                                <>
                                    <CheckCircleOutlined
                                        style={{ color: "#1890ff" }}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: "#1890ff",
                                        }}
                                    >
                                        Saved (pending sync)
                                    </Text>
                                </>
                            )}
                            {syncStatus === "syncing" && (
                                <>
                                    <CheckCircleOutlined
                                        style={{ color: "#1890ff" }}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: "#1890ff",
                                        }}
                                    >
                                        Syncing...
                                    </Text>
                                </>
                            )}
                            {syncStatus === "failed" && (
                                <>
                                    <ExclamationCircleOutlined
                                        style={{ color: "#faad14" }}
                                    />
                                    <Text
                                        type="warning"
                                        style={{ fontSize: 12 }}
                                    >
                                        {syncError || "Sync failed"}
                                    </Text>
                                </>
                            )}
                        </Flex>
                    )}
                    {(!syncStatus || syncStatus === "draft") && <div />}
                    <Flex gap="middle">
                        <Button
                            onClick={() => {
                                form.resetFields();
                                setIsModalOpen(() => false);
                            }}
                            style={{ borderRadius: 8 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={isSubmitting}
                            style={{
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                borderColor: "#7c3aed",
                                borderRadius: 8,
                                fontWeight: 500,
                                paddingLeft: 32,
                                paddingRight: 32,
                            }}
                        >
                            {submitButtonText}
                        </Button>
                        <Button
                            type="primary"
                            style={{
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                borderColor: "#7c3aed",
                                borderRadius: 8,
                                fontWeight: 500,
                                paddingLeft: 32,
                                paddingRight: 32,
                            }}
                        >
                            Register & Add Another
                        </Button>
                    </Flex>
                </Flex>
            }
            styles={{
                body: {
                    maxHeight: "75vh",
                    overflow: "auto",
                },
                wrapper: {},
                container: {
                    backgroundColor: "#f5f5f5",
                },
            }}
        >
            <Form
                form={form}
                layout="vertical"
                fields={fields}
                onFinish={onStageSubmit}
                style={{ margin: 0, padding: 0 }}
                initialValues={trackedEntity?.attributes}
            >
                <Flex vertical gap={10}>
                    <Card
                        title="Registration Details"
                        style={{
                            borderRadius: 0,
                        }}
                        size="small"
                    >
                        <Row gutter={[16, 0]}>
                            <DataElementField
                                dataElement={{
                                    code: "TRACKER_ID",
                                    id: "TRACKER_ID",
                                    confidential: false,
                                    name: "Tracker ID",
                                    valueType: "DATE",
                                    displayFormName: "Registration Date",
                                    generated: false,
                                    optionSetValue: false,
                                    unique: true,
                                    pattern: "",
                                    formName: "Registration Date",
                                }}
                                hidden={false}
                                finalOptions={[]}
                                messages={[]}
                                warnings={[]}
                                errors={[]}
                                required={true}
                                form={form}
                                xs={24}
                                sm={24}
                                md={24}
                                lg={24}
                                xl={24}
                                desktopRenderType={"DEFAULT"}
                                onAutoSave={updateFieldWithRules}
                            />
                        </Row>
                    </Card>
                    {program.programSections.map(
                        ({ name, trackedEntityAttributes: tei, id }) => {
                            const allAreHidden = tei.every(({ id }) =>
                                ruleResult.hiddenFields.has(id),
                            );
                            if (allAreHidden) {
                                return null;
                            }
                            return (
                                <Card
                                    title={name}
                                    key={id}
                                    style={{
                                        borderRadius: 0,
                                    }}
                                    size="small"
                                >
                                    <Row gutter={[16, 0]}>
                                        {tei.map(({ id }) => {
                                            if (
                                                ruleResult.hiddenFields.has(
                                                    id,
                                                ) &&
                                                ruleResult.shownOptionGroups[
                                                    id
                                                ] === undefined
                                            ) {
                                                return [];
                                            }
                                            const current =
                                                trackedEntityAttributes.get(
                                                    id,
                                                )!;
                                            if (
                                                ruleResult.hiddenSections.has(
                                                    id,
                                                )
                                            )
                                                return [];

                                            const optionSet =
                                                current.optionSet?.id ?? "";

                                            const finalOptions = optionSets
                                                .get(optionSet)
                                                ?.flatMap((o) => {
                                                    if (
                                                        ruleResult.hiddenOptions[
                                                            o.id
                                                        ]?.has(o.id)
                                                    ) {
                                                        return [];
                                                    }
                                                    return o;
                                                });

                                            const errors =
                                                ruleResult.errors.filter(
                                                    (msg) => msg.key === id,
                                                );
                                            const messages =
                                                ruleResult.messages.filter(
                                                    (msg) => msg.key === id,
                                                );
                                            const warnings =
                                                ruleResult.warnings.filter(
                                                    (msg) => msg.key === id,
                                                );

                                            const {
                                                desktopRenderType,
                                                mandatory,
                                            } = allAttributes.get(id)!;

                                            return (
                                                <DataElementField
                                                    key={id}
                                                    dataElement={current}
                                                    hidden={false}
                                                    finalOptions={finalOptions}
                                                    messages={messages}
                                                    warnings={warnings}
                                                    errors={errors}
                                                    required={mandatory}
                                                    disabled={
                                                        id in
                                                        ruleResult.assignments
                                                    }
                                                    xs={calculateColSpan(
                                                        tei.length,
                                                        24,
                                                    )}
                                                    sm={calculateColSpan(
                                                        tei.length,
                                                        24,
                                                    )}
                                                    md={calculateColSpan(
                                                        tei.length,
                                                        24,
                                                    )}
                                                    lg={calculateColSpan(
                                                        tei.length,
                                                        12,
                                                    )}
                                                    xl={
                                                        spans.get(id) ||
                                                        calculateColSpan(
                                                            tei.length,
                                                            6,
                                                        )
                                                    }
                                                    form={form}
                                                    desktopRenderType={
                                                        desktopRenderType?.type
                                                    }
                                                    onAutoSave={
                                                        updateFieldWithRules
                                                    }
                                                />
                                            );
                                        })}
                                    </Row>
                                </Card>
                            );
                        },
                    )}
                </Flex>
            </Form>
        </Modal>
    );
};
