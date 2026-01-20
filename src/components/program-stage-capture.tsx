import {
	CheckCircleOutlined,
	ExclamationCircleOutlined,
	ExperimentOutlined,
	EyeOutlined,
	PlusOutlined
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
import { singular } from "pluralize";
import React, { useCallback, useEffect, useState } from "react";
import { useEventAutoSave } from "../hooks/useEventAutoSave";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { ProgramStage } from "../schemas";
import { createEmptyEvent, flattenTrackedEntity } from "../utils/utils";
import { DataElementField } from "./data-element-field";

const { Text } = Typography;

export const ProgramStageCapture: React.FC<{
    programStage: ProgramStage;
}> = ({ programStage }) => {
    const [stageForm] = Form.useForm();
    const {
        dataElements,
        optionGroups,
        optionSets,
        programRuleVariables,
        programRules,
    } = RootRoute.useLoaderData();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState(0);
    const medicines = new Map(
        optionSets.get("Fm205YyFeRg")?.map(({ code, name }) => [code, name]),
    );
    const programStageDataElements = new Map(
        programStage.programStageDataElements.map((psde) => [
            psde.dataElement.id,
            {
                allowFutureDate: psde.allowFutureDate,
                renderOptionsAsRadio: psde.renderType !== undefined,
                compulsory: psde.compulsory,
                vertical: psde.renderType
                    ? psde.renderType.DESKTOP?.type !==
                      "HORIZONTAL_RADIOBUTTONS"
                    : false,
                ...dataElements.get(psde.dataElement.id),
            },
        ]),
    );
    const enrollment = TrackerContext.useSelector(
        (state) => state.context.trackedEntity.enrollment,
    );
    const trackerActor = TrackerContext.useActorRef();

    const currentEvent = TrackerContext.useSelector(
        (state) => state.context.currentEvent,
    );
    const mainEvent = TrackerContext.useSelector(
        (state) => state.context.mainEvent,
    );

    const ruleResult = TrackerContext.useSelector(
        (state) => state.context.currentEventRuleResults,
    );

    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    // Initialize auto-save hook
    const { triggerAutoSave, savingState, errorMessage, isEventCreated } =
        useEventAutoSave({
            form: stageForm,
            event: currentEvent,
            trackerActor,
            ruleResult: ruleResult,
            onEventCreated: (newEventId) => {
                trackerActor.send({
                    type: "UPDATE_EVENT_ID",
                    oldId: currentEvent.event,
                    newId: newEventId,
                });
                setModalKey(Number(newEventId) || 0);
            },
        });

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

    const events = TrackerContext.useSelector((state) =>
        state.context.trackedEntity?.events.filter(
            (e) =>
                e.programStage === programStage.id &&
                e.occurredAt === mainEvent.occurredAt,
        ),
    );

    const showVisitModal = (
        visit: ReturnType<typeof flattenTrackedEntity>["events"][number],
    ) => {
        trackerActor.send({ type: "SET_CURRENT_EVENT", currentEvent: visit });
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(true);
    };

    const showCreateVisitModal = () => {
        stageForm.resetFields();
        const emptyEvent = createEmptyEvent({
            program: enrollment.program,
            trackedEntity: enrollment.trackedEntity,
            enrollment: enrollment.enrollment,
            orgUnit: enrollment.orgUnit,
            programStage: programStage.id,
        });

        trackerActor.send({
            type: "SET_CURRENT_EVENT",
            currentEvent: emptyEvent,
        });
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(true);
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
            render: (_, record) => (
                <Button
                    icon={<EyeOutlined />}
                    onClick={() => {
                        showVisitModal(record);
                    }}
                >
                    View
                </Button>
            ),
        },
    ];

    const handleTriggerProgramRules = useCallback(() => {
        const allValues = stageForm.getFieldsValue();
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            dataValues: allValues,
            attributeValues: trackedEntity.attributes,
            programStage: programStage.id,
            programRules,
            programRuleVariables,
            enrollment: trackedEntity.enrollment,
            ruleResultKey: "currentEventRuleResults",
            ruleResultUpdateKey: "currentEvent",
            updateKey: "dataValues",
        });
    }, [
        trackedEntity.attributes,
        stageForm,
        programStage.id,
        programRules,
        programRuleVariables,
        trackerActor,
    ]);

    useEffect(() => {
        if (isVisitModalOpen) {
            stageForm.resetFields();
            if (
                currentEvent.dataValues &&
                Object.keys(currentEvent.dataValues).length > 0
            ) {
                trackerActor.send({
                    type: "EXECUTE_PROGRAM_RULES",
                    dataValues: currentEvent.dataValues,
                    attributeValues: trackedEntity.attributes,
                    programStage: programStage.id,
                    programRules,
                    programRuleVariables,
                    enrollment: trackedEntity.enrollment,
                    ruleResultKey: "currentEventRuleResults",
                    ruleResultUpdateKey: "currentEvent",
                    updateKey: "dataValues",
                });
            } else {
                console.log("✨ Creating new stage event with empty form");
            }
        }
    }, [isVisitModalOpen, currentEvent.event, trackerActor, stageForm]);

    useEffect(() => {
        if (
            isVisitModalOpen &&
            Object.keys(ruleResult.assignments).length > 0
        ) {
            stageForm.setFieldsValue(ruleResult.assignments);

            // Trigger auto-save for program rule assignments if event already created
            // Only save assignments that belong to this stage
            if (isEventCreated) {
                const stageDataElementIds = new Set(
                    programStage.programStageDataElements.map(
                        (psde) => psde.dataElement.id,
                    ),
                );

                Object.entries(ruleResult.assignments).forEach(
                    ([key, value]) => {
                        // Only trigger auto-save if this data element belongs to current stage
                        if (stageDataElementIds.has(key)) {
                            triggerAutoSave(key, value);
                        }
                    },
                );
            }
        }
    }, [
        ruleResult.assignments,
        isVisitModalOpen,
        stageForm,
        isEventCreated,
        triggerAutoSave,
        programStage.programStageDataElements,
    ]);

    const [shouldCreateAgain, setShouldCreateAgain] = useState(false);

    const onStageSubmit = (values: Record<string, any>) => {
        if (ruleResult.errors.length > 0) {
            console.error(
                "Form has validation errors from program rules:",
                ruleResult.errors,
            );
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
            const event: ReturnType<
                typeof flattenTrackedEntity
            >["events"][number] = {
                ...currentEvent,
                occurredAt: mainEvent.occurredAt,
                dataValues: { ...currentEvent.dataValues, ...finalValues },
            };
            trackerActor.send({
                type: "CREATE_OR_UPDATE_EVENT",
                event,
            });

            // Check if we should create another record
            if (shouldCreateAgain) {
                // Reset the flag
                setShouldCreateAgain(false);
                // Reset form and create new event
                stageForm.resetFields();
                trackerActor.send({ type: "RESET_CURRENT_EVENT" });
                // Show success message
                message.success({
                    content: `${singular(programStage.name)} saved successfully!`,
                    duration: 2,
                });
                // Create a new empty event
                showCreateVisitModal();
            } else {
                // Close modal and reset
                setIsVisitModalOpen(false);
                stageForm.resetFields();
                trackerActor.send({ type: "RESET_CURRENT_EVENT" });
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
                            {savingState !== "idle" && (
                                <Flex align="center" gap="small">
                                    {savingState === "saved" && (
                                        <>
                                            <CheckCircleOutlined
                                                style={{ color: "#52c41a" }}
                                            />
                                            <Text
                                                type="success"
                                                style={{ fontSize: 12 }}
                                            >
                                                Saved
                                            </Text>
                                        </>
                                    )}
                                    {savingState === "error" && (
                                        <>
                                            <ExclamationCircleOutlined
                                                style={{ color: "#faad14" }}
                                            />
                                            <Text
                                                type="warning"
                                                style={{ fontSize: 12 }}
                                            >
                                                {errorMessage}
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
                                    trackerActor.send({
                                        type: "RESET_CURRENT_EVENT",
                                    });
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
                    initialValues={currentEvent.dataValues}
                >
                    <Flex vertical>
                        {programStage.programStageSections.flatMap(
                            (section) => {
                                if (ruleResult.hiddenSections.has(section.id))
                                    return [];

                                return (
                                    <Row gutter={[24, 16]} key={section.id}>
                                        {section.dataElements.flatMap(
                                            (dataElement) => {
                                                const {
                                                    vertical = false,
                                                    renderOptionsAsRadio = false,
                                                } =
                                                    programStageDataElements.get(
                                                        dataElement.id,
                                                    ) ?? {};

                                                const currentDataElement =
                                                    dataElements.get(
                                                        dataElement.id,
                                                    );
                                                if (
                                                    ruleResult.hiddenFields.has(
                                                        dataElement.id,
                                                    )
                                                ) {
                                                    return [];
                                                }

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
                                                        messages={messages}
                                                        warnings={warnings}
                                                        errors={errors}
                                                        required={compulsory}
                                                        key={`${section.id}${dataElement.id}`}
                                                        form={stageForm}
                                                        onTriggerProgramRules={
                                                            handleTriggerProgramRules
                                                        }
                                                        onAutoSave={
                                                            triggerAutoSave
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
