import {
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    ExperimentOutlined,
    EyeOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import {
    Button,
    Flex,
    Form,
    message,
    Modal,
    Row,
    Table,
    TableProps,
    Typography,
} from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { singular } from "pluralize";
import React, { useCallback, useEffect, useState } from "react";
import { db, FlattenedEvent, FlattenedTrackedEntity } from "../db";
import { useDexiePersistence } from "../hooks/useDexiePersistence";
import { useTrackerFormInit } from "../hooks/useTrackerFormInit";
import { useEventSyncStatus } from "../hooks/useEntitySyncStatus";
import { useEventValidation } from "../hooks/useEventValidation";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { RootRoute } from "../routes/__root";
import { ProgramStage } from "../schemas";
import {
    calculateColSpan,
    createEmptyEvent,
    flattenTrackedEntity,
} from "../utils/utils";
import { DataElementField } from "./data-element-field";

const { Text } = Typography;

export const ProgramStageCapture: React.FC<{
    programStage: ProgramStage;
    trackedEntity: FlattenedTrackedEntity;
    mainEvent: FlattenedEvent;
    captureMode?: "modal" | "inline"; // Configure how to add new records
}> = ({ programStage, trackedEntity, mainEvent, captureMode = "modal" }) => {
    const [localEventId, setLocalEventId] = useState<string>("");
    const [stageForm] = Form.useForm();
    const {
        dataElements,
        optionGroups,
        optionSets,
        programRuleVariables,
        programRules,
        program,
    } = RootRoute.useLoaderData();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState(0);
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const medicines = new Map(
        optionSets.get("Fm205YyFeRg")?.map(({ code, name }) => [code, name]),
    );

    // Use unified persistence hook
    const {
        entity: currentEvent,
        updateField,
        updateFields,
    } = useDexiePersistence<FlattenedEvent>({
        entityType: "event",
        entityId: localEventId,
    });

    // Use program rules with autoExecute enabled
    const { ruleResult, executeAndApplyRules, triggerAutoExecute } =
        useProgramRulesWithDexie({
            form: stageForm,
            programRules,
            programRuleVariables,
            programStage: programStage.id,
            trackedEntityAttributes: trackedEntity.attributes,
            enrollment: trackedEntity.enrollment,
            onAssignments: updateFields,
            applyAssignmentsToForm: true,
            persistAssignments: true,
            clearHiddenFields: true, // Automatically clear hidden fields
            program: program.id,
            debounceMs: 300,
            autoExecute: true, // Enable automatic rule execution
        });

    // Wrap updateField to also trigger program rules
    const updateFieldWithRules = useCallback(
        (fieldId: string, value: any) => {
            updateField(fieldId, value);
            triggerAutoExecute();
        },
        [updateField, triggerAutoExecute],
    );

    // Use unified form initialization hook (for both modal and inline modes)
    useTrackerFormInit({
        form: stageForm,
        entity: currentEvent,
        initialValues: {},
        executeRules: executeAndApplyRules,
        enabled: isVisitModalOpen || inlineEditingId !== null,
    });

    const { isValid, readyToCreate } = useEventValidation({
        programStage: programStage,
        dataValues: currentEvent?.dataValues || {},
        occurredAt: currentEvent?.occurredAt,
    });

    // Auto-mark event as ready when validation passes
    useEffect(() => {
        if (readyToCreate && currentEvent?.syncStatus === "draft") {
            db.events.update(currentEvent.event, { syncStatus: "pending" });
        }
    }, [readyToCreate, currentEvent?.syncStatus, currentEvent?.event]);

    // Get sync status for current event
    const { syncStatus, isPending, isSyncing, hasFailed, syncError } =
        useEventSyncStatus(localEventId);

    const currentDataElements = new Map(
        programStage.programStageDataElements.map((psde) => [
            psde.dataElement.id,
            {
                allowFutureDate: psde.allowFutureDate,
                renderOptionsAsRadio: psde.renderType !== undefined,
                compulsory: psde.compulsory,
                desktopRenderType: psde.renderType?.DESKTOP?.type,
            },
        ]),
    );

    const events =
        useLiveQuery(async () => {
            if (!trackedEntity.trackedEntity || !mainEvent.event) return [];
            return await db.events
                .where("trackedEntity")
                .equals(trackedEntity.trackedEntity)
                .and(
                    (e) =>
                        e.programStage === programStage.id &&
                        e.parentEvent === mainEvent.event,
                )
                .toArray();
        }, [trackedEntity.trackedEntity, programStage.id, mainEvent.event]) ||
        [];

    const showVisitModal = (
        visit: ReturnType<typeof flattenTrackedEntity>["events"][number],
    ) => {
        // trackerActor.send({ type: "SET_CURRENT_EVENT", currentEvent: visit });
        setLocalEventId(visit.event);
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(true);
    };

    const showCreateVisitModal = async () => {
        if (!mainEvent?.event) {
            message.error(
                "Cannot create child event: parent event is not loaded",
            );
            return;
        }

        stageForm.resetFields();
        const emptyEvent = createEmptyEvent({
            program: trackedEntity.enrollment.program,
            trackedEntity: trackedEntity.trackedEntity,
            enrollment: trackedEntity.enrollment.enrollment,
            orgUnit: trackedEntity.orgUnit,
            programStage: programStage.id,
            parentEvent: mainEvent.event,
        });

        // Save the empty event to DexieJS immediately
        await db.events.put(emptyEvent as any);

        setLocalEventId(emptyEvent.event);

        if (captureMode === "modal") {
            setModalKey((prev) => prev + 1);
            setIsVisitModalOpen(true);
        } else {
            // Inline mode - set the new event as being edited
            setInlineEditingId(emptyEvent.event);
        }
    };

    const columns: TableProps<
        ReturnType<typeof flattenTrackedEntity>["events"][number]
    >["columns"] = [
        {
            title: "Date",
            dataIndex: "occurredAt",
            key: "date",
            render: (date) => dayjs(date).format("MMM DD, YYYY"),
        },
        ...programStage.programStageSections.flatMap((section) => {
            return section.dataElements.map((de) => {
                const currentDataElement = dataElements.get(de.id)!;
                return {
                    title:
                        currentDataElement.formName || currentDataElement.name,
                    key: de.id,
                    dataIndex: ["dataValues", de.id],
                    render: (value: string) => medicines.get(value) || value,
                };
            });
        }),
        {
            title: "Action",
            key: "action",
            width: 100,
            fixed: "right",
            render: (_, record) => (
                <Flex gap="small" align="center">
                    <Button
                        danger
                        onClick={() => {
                            Modal.confirm({
                                title: 'Delete Event',
                                content: 'Are you sure you want to delete this event? This action cannot be undone.',
                                okText: 'Delete',
                                okType: 'danger',
                                onOk: async () => {
                                    try {
                                        await db.events.delete(record.event);
                                        message.success('Event deleted successfully');
                                    } catch (error) {
                                        console.error('Failed to delete event:', error);
                                        message.error('Failed to delete event');
                                    }
                                }
                            });
                        }}
                    >
                        Delete
                    </Button>
                    <Button
                        icon={<EyeOutlined />}
                        onClick={() => {
                            showVisitModal(record);
                        }}
                    >
                        View
                    </Button>
                </Flex>
            ),
        },
    ];

    const [shouldCreateAgain, setShouldCreateAgain] = useState(false);

    const onStageSubmit = async (values: Record<string, any>) => {
        if (ruleResult.errors.length > 0) {
            message.error({
                content: `Validation failed: ${ruleResult.errors.map((e) => e.content).join(", ")}`,
                duration: 5,
            });
            return;
        }
        try {
            const finalValues = {
                ...values,
                ...ruleResult.assignments,
            };

            // Update event data in Dexie (automatic sync)
            await updateFields(finalValues);

            // Check if we should create another record
            if (shouldCreateAgain) {
                // Reset the flag
                setShouldCreateAgain(false);
                // Reset form and create new event
                stageForm.resetFields();
                // Show success message
                message.success({
                    content: `${singular(programStage.name)} saved successfully!`,
                    duration: 2,
                });
                // Create a new empty event
                showCreateVisitModal();
            } else {
                // Close modal/inline and reset
                if (captureMode === "modal") {
                    setIsVisitModalOpen(false);
                } else {
                    setInlineEditingId(null);
                }
                stageForm.resetFields();
                // Clear the local event ID
                setLocalEventId("");
                message.success({
                    content: `${singular(programStage.name)} saved successfully!`,
                    duration: 2,
                });
            }
        } catch (error) {
            console.error("Error saving record:", error);
            message.error({
                content: "Failed to save record. Please try again.",
                duration: 5,
            });
        }
    };

    const handleSubmit = async (createAgain: boolean = false) => {
        try {
            // Set the flag before submitting
            setShouldCreateAgain(createAgain);
            await stageForm.validateFields();
            stageForm.submit();
        } catch (error) {
            console.error("Form validation failed:", error);
            // Reset the flag if validation fails
            setShouldCreateAgain(false);
        }
    };

    const renderInlineEditForm = (record: FlattenedEvent) => {
        return (
            <div style={{ padding: "16px", background: "#fafafa" }}>
                <Form
                    form={stageForm}
                    layout="vertical"
                    onFinish={onStageSubmit}
                >
                    <Flex vertical gap={16}>
                        {programStage.programStageSections.flatMap((section) => {
                            if (ruleResult.hiddenSections.has(section.id))
                                return [];

                            return (
                                <Row gutter={[16, 0]} key={section.id}>
                                    {section.dataElements.flatMap((dataElement) => {
                                        if (
                                            ruleResult.hiddenFields.has(
                                                dataElement.id,
                                            ) &&
                                            ruleResult.shownOptionGroups[
                                                dataElement.id
                                            ] === undefined
                                        ) {
                                            return [];
                                        }

                                        const currentDataElement =
                                            dataElements.get(dataElement.id);

                                        const optionSet =
                                            currentDataElement?.optionSet?.id ?? "";

                                        const hiddenOptions =
                                            ruleResult.hiddenOptions[dataElement.id];

                                        const shownOptionGroups =
                                            ruleResult.shownOptionGroups[
                                                dataElement.id
                                            ] || new Set<string>();

                                        let finalOptions = optionSets
                                            .get(optionSet)
                                            ?.flatMap((o) => {
                                                if (hiddenOptions?.has(o.id)) {
                                                    return [];
                                                }
                                                return o;
                                            });

                                        if (shownOptionGroups.size > 0) {
                                            const currentOptions =
                                                optionGroups.get(
                                                    shownOptionGroups.values().next().value,
                                                ) ?? [];
                                            finalOptions = currentOptions.map(
                                                ({ code, id, name }) => ({
                                                    id,
                                                    code,
                                                    name,
                                                    optionSet,
                                                }),
                                            );
                                        }

                                        const errors =
                                            ruleResult.errors.filter(
                                                (msg) => msg.key === dataElement.id,
                                            );
                                        const messages =
                                            ruleResult.messages.filter(
                                                (msg) => msg.key === dataElement.id,
                                            );
                                        const warnings =
                                            ruleResult.warnings.filter(
                                                (msg) => msg.key === dataElement.id,
                                            );
                                        const stageDataElement =
                                            programStage.programStageDataElements.find(
                                                (de) => de.id === dataElement.id,
                                            );
                                        const compulsory =
                                            stageDataElement?.compulsory ?? false;
                                        const desktopRenderType =
                                            stageDataElement?.renderType?.DESKTOP;

                                        return (
                                            <DataElementField
                                                key={dataElement.id}
                                                dataElement={currentDataElement!}
                                                hidden={ruleResult.hiddenFields.has(
                                                    dataElement.id,
                                                )}
                                                finalOptions={finalOptions ?? []}
                                                errors={errors}
                                                messages={messages}
                                                warnings={warnings}
                                                required={compulsory}
                                                span={calculateColSpan(
                                                    section.dataElements.length,
                                                    2,
                                                )}
                                                form={stageForm}
                                                onAutoSave={updateFieldWithRules}
                                                desktopRenderType={
                                                    desktopRenderType?.type
                                                }
                                            />
                                        );
                                    })}
                                </Row>
                            );
                        })}
                        <Flex justify="flex-end" gap="small">
                            <Button
                                onClick={() => {
                                    stageForm.resetFields();
                                    setInlineEditingId(null);
                                    setLocalEventId("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => handleSubmit()}
                            >
                                Save
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => handleSubmit(true)}
                            >
                                Save & Create Another
                            </Button>
                        </Flex>
                    </Flex>
                </Form>
            </div>
        );
    };

    return (
        <Flex
            style={{
                backgroundColor: "#ffffff",
                width: "100%",
                padding: "16px",
            }}
            vertical
        >
            <Table
                columns={columns}
                dataSource={events}
                pagination={false}
                rowKey="event"
                scroll={{ x: "max-content" }}
                expandable={
                    captureMode === "inline"
                        ? {
                              expandedRowKeys: inlineEditingId ? [inlineEditingId] : [],
                              onExpand: (expanded, record) => {
                                  if (expanded) {
                                      setInlineEditingId(record.event);
                                      setLocalEventId(record.event);
                                  } else {
                                      setInlineEditingId(null);
                                      setLocalEventId("");
                                  }
                              },
                              expandedRowRender: (record) => {
                                  // Render the inline edit form with a key to force re-render
                                  return (
                                      <div key={record.event}>
                                          {renderInlineEditForm(record)}
                                      </div>
                                  );
                              },
                          }
                        : undefined
                }
                title={() => {
                    return (
                        <Flex
                            style={{
                                width: "100%",
                            }}
                            justify="space-between"
                            align="center"
                        >
                            <Flex align="center" gap="small">
                                <ExperimentOutlined
                                    style={{
                                        fontSize: 28,
                                        color: "#7c3aed",
                                    }}
                                />
                                <Text
                                    strong
                                    style={{
                                        fontSize: 14,
                                    }}
                                >
                                    {programStage.name}
                                </Text>
                            </Flex>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={showCreateVisitModal}
                                size="middle"
                                style={{
                                    background: "#7c3aed",
                                    borderColor: "#7c3aed",
                                    borderRadius: 6,
                                }}
                            >
                                Add {programStage.name}
                            </Button>
                        </Flex>
                    );
                }}
            />
            <Modal
                key={modalKey}
                open={isVisitModalOpen}
                onCancel={() => {
                    stageForm.resetFields();
                    // Clear the local event ID to prevent stale data
                    setLocalEventId("");
                    // trackerActor.send({ type: "RESET_CURRENT_EVENT" });
                    setIsVisitModalOpen(false);
                }}
                title={
                    <Flex align="center" gap="middle">
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                            }}
                        >
                            <ExperimentOutlined style={{ fontSize: 16 }} />
                        </div>
                        <Text strong style={{ fontSize: 16 }}>
                            {singular(programStage.name)}
                        </Text>
                    </Flex>
                }
                width="70vw"
                footer={
                    <Flex
                        justify="space-between"
                        align="center"
                        gap="middle"
                        style={{ padding: "8px 0" }}
                    >
                        <Flex>
                            &nbsp;&nbsp;
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
                        </Flex>
                        <Flex gap="middle">
                            <Button
                                onClick={() => {
                                    stageForm.resetFields();
                                    // Clear the local event ID
                                    setLocalEventId("");
                                    // trackerActor.send({
                                    //     type: "RESET_CURRENT_EVENT",
                                    // });
                                    setIsVisitModalOpen(false);
                                }}
                                style={{ borderRadius: 8 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => handleSubmit()}
                                style={{
                                    background:
                                        "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                    borderColor: "#7c3aed",
                                    borderRadius: 8,
                                    fontWeight: 500,
                                    paddingLeft: 28,
                                    paddingRight: 28,
                                }}
                            >
                                Save {singular(programStage.name)} & Close
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => handleSubmit(true)}
                                style={{
                                    background:
                                        "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                    borderColor: "#7c3aed",
                                    borderRadius: 8,
                                    fontWeight: 500,
                                    paddingLeft: 28,
                                    paddingRight: 28,
                                }}
                            >
                                Save {singular(programStage.name)} & Create
                                Another
                            </Button>
                        </Flex>
                    </Flex>
                }
                styles={{
                    body: {
                        maxHeight: "70vh",
                        overflow: "auto",
                        background: "#fafafa",
                        padding: "24px 28px",
                    },
                }}
                centered
            >
                <Form
                    form={stageForm}
                    layout="vertical"
                    onFinish={onStageSubmit}
                    style={{ margin: 0, padding: 0 }}
                    initialValues={currentEvent?.dataValues}
                >
                    <Flex vertical>
                        {programStage.programStageSections.flatMap(
                            (section) => {
                                if (ruleResult.hiddenSections.has(section.id))
                                    return [];

                                return (
                                    <Row gutter={[16, 0]} key={section.id}>
                                        {section.dataElements.flatMap(
                                            (dataElement) => {
                                                if (
                                                    ruleResult.hiddenFields.has(
                                                        dataElement.id,
                                                    ) &&
                                                    ruleResult
                                                        .shownOptionGroups[
                                                        dataElement.id
                                                    ] === undefined
                                                ) {
                                                    return [];
                                                }

                                                const currentDataElement =
                                                    dataElements.get(
                                                        dataElement.id,
                                                    );

                                                const optionSet =
                                                    currentDataElement
                                                        ?.optionSet?.id ?? "";

                                                const hiddenOptions =
                                                    ruleResult.hiddenOptions[
                                                        dataElement.id
                                                    ];

                                                const shownOptionGroups =
                                                    ruleResult
                                                        .shownOptionGroups[
                                                        dataElement.id
                                                    ] || new Set<string>();

                                                let finalOptions = optionSets
                                                    .get(optionSet)
                                                    ?.flatMap((o) => {
                                                        if (
                                                            hiddenOptions?.has(
                                                                o.id,
                                                            )
                                                        ) {
                                                            return [];
                                                        }
                                                        return o;
                                                    });

                                                if (
                                                    shownOptionGroups.size > 0
                                                ) {
                                                    const currentOptions =
                                                        optionGroups.get(
                                                            shownOptionGroups
                                                                .values()
                                                                .next().value,
                                                        ) ?? [];
                                                    finalOptions =
                                                        currentOptions.map(
                                                            ({
                                                                code,
                                                                id,
                                                                name,
                                                            }) => ({
                                                                id,
                                                                code,
                                                                name,
                                                                optionSet,
                                                            }),
                                                        );
                                                }

                                                const errors =
                                                    ruleResult.errors.filter(
                                                        (msg) =>
                                                            msg.key ===
                                                            dataElement.id,
                                                    );
                                                const messages =
                                                    ruleResult.messages.filter(
                                                        (msg) =>
                                                            msg.key ===
                                                            dataElement.id,
                                                    );
                                                const warnings =
                                                    ruleResult.warnings.filter(
                                                        (msg) =>
                                                            msg.key ===
                                                            dataElement.id,
                                                    );
                                                const {
                                                    compulsory = false,
                                                    desktopRenderType,
                                                } =
                                                    currentDataElements.get(
                                                        dataElement.id,
                                                    ) || {};

                                                return (
                                                    <DataElementField
                                                        dataElement={
                                                            currentDataElement!
                                                        }
                                                        hidden={false}
                                                        finalOptions={
                                                            finalOptions
                                                        }
                                                        desktopRenderType={
                                                            desktopRenderType
                                                        }
                                                        span={calculateColSpan(
                                                            section.dataElements
                                                                .length,
                                                            6,
                                                        )}
                                                        messages={messages}
                                                        warnings={warnings}
                                                        errors={errors}
                                                        required={compulsory}
                                                        disabled={
                                                            dataElement.id in
                                                            ruleResult.assignments
                                                        }
                                                        key={`${section.id}${dataElement.id}`}
                                                        form={stageForm}
                                                        onAutoSave={
                                                            updateFieldWithRules
                                                        }
                                                    />
                                                );
                                            },
                                        )}
                                    </Row>
                                );
                            },
                        )}
                    </Flex>
                </Form>
            </Modal>
        </Flex>
    );
};
