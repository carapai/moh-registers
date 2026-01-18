import { PlusOutlined, UserAddOutlined } from "@ant-design/icons";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { DataElementField } from "./data-element-field";
import { RootRoute } from "../routes/__root";
import { flattenTrackedEntity } from "../utils/utils";
import { getTrackedEntityDraft } from "../db/operations";
import { useAutoSave } from "../hooks/useAutoSave";
import { RenderType } from "../schemas";

const { Text } = Typography;

const spans = new Map<string, number>([
    ["XjgpfkoxffK", 4],
    ["rN2iZ0q1NWV", 4],
    ["W87HAtUHJjB", 4],
    ["PKuyTiVCR89", 4],
    ["oTI0DLitzFY", 8],
]);

export const TrackerRegistration: React.FC = () => {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRuleVariables,
        programRules,
        programOrgUnits,
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
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState(0);
    const [form] = Form.useForm();
    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );
    const ruleResult = TrackerContext.useSelector(
        (state) => state.context.registrationRuleResults,
    );

    const trackerActor = TrackerContext.useActorRef();
    const machineState = TrackerContext.useSelector((state) => state.value);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const orgUnit = TrackerContext.useSelector(
        (state) => state.context.orgUnit.id,
    );

    // Auto-save registration drafts
    const { clearDraft } = useAutoSave({
        form: form,
        draftId: trackedEntity.trackedEntity || "temp-registration",
        type: "trackedEntity",
        interval: 30000, // 30 seconds
        enabled: isVisitModalOpen,
        metadata: {
            orgUnit: trackedEntity.orgUnit || "",
            program: program.id,
            enrollment: trackedEntity.enrollment?.enrollment || "",
            isNew:
                !trackedEntity.trackedEntity ||
                trackedEntity.trackedEntity.startsWith("temp"),
        },
        onSave: () => console.log("💾 Registration draft auto-saved"),
    });

    const fields = useMemo(() => {
        return Object.entries(trackedEntity.attributes || {}).map(
            ([name, value]) => ({
                name,
                value,
            }),
        );
    }, []);

    const handleTriggerProgramRules = useCallback(() => {
        const allValues = form.getFieldsValue();
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            attributeValues: allValues,
            programRules: programRules,
            programRuleVariables: programRuleVariables,
            ruleResultKey: "registrationRuleResults",
            ruleResultUpdateKey: "trackedEntity",
            updateKey: "attributes",
        });
    }, [form, trackerActor, programRules, programRuleVariables]);

    useEffect(() => {
        const loadDraftIfExists = async () => {
            if (isVisitModalOpen && trackedEntity.trackedEntity) {
                // Check if a draft exists for this tracked entity
                const draft = await getTrackedEntityDraft(
                    trackedEntity.trackedEntity,
                );

                if (
                    draft &&
                    draft.attributes &&
                    Object.keys(draft.attributes).length > 0
                ) {
                    // Ask user if they want to restore the draft
                    Modal.confirm({
                        title: "Draft Found",
                        content: `A saved registration draft was found (last saved: ${new Date(draft.updatedAt).toLocaleString()}). Would you like to restore it?`,
                        okText: "Restore Draft",
                        cancelText: "Start Fresh",
                        onOk: () => {
                            // Load draft data into form
                            form.setFieldsValue(draft.attributes);
                            message.success("Draft restored successfully");
                        },
                        onCancel: () => {
                            // User chose to start fresh, do nothing
                            message.info("Starting with a fresh form");
                        },
                    });
                }

                // Execute program rules regardless of draft
                trackerActor.send({
                    type: "EXECUTE_PROGRAM_RULES",
                    attributeValues: trackedEntity.attributes,
                    programRules: programRules,
                    programRuleVariables: programRuleVariables,
                    ruleResultKey: "registrationRuleResults",
                    ruleResultUpdateKey: "trackedEntity",
                    updateKey: "attributes",
                });
            }
        };

        loadDraftIfExists();
    }, [isVisitModalOpen, trackedEntity.trackedEntity]);

    // Apply assignments when rule results change
    useEffect(() => {
        if (
            isVisitModalOpen &&
            Object.keys(ruleResult.assignments).length > 0
        ) {
            form.setFieldsValue(ruleResult.assignments);
        }
    }, [ruleResult.assignments, isVisitModalOpen, form]);

    // Listen for state machine transitions and show appropriate messages
    // Only show success message if we were actually submitting
    useEffect(() => {
        if (machineState === "entitySuccess" && isSubmitting) {
            message.success({
                content: "Patient registered successfully!",
                duration: 3,
            });
            // Clear draft after successful save
            clearDraft();
            setIsSubmitting(false);
        } else if (machineState === "failure" && isSubmitting) {
            message.error({
                content: "Failed to save patient. Please try again.",
                duration: 5,
            });
            setIsSubmitting(false);
        }
    }, [machineState, isSubmitting, clearDraft]);

    const onStageSubmit = (values: any) => {
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
            const current: ReturnType<typeof flattenTrackedEntity> = {
                ...trackedEntity,
                attributes: { ...trackedEntity.attributes, ...values },
            };
            setIsSubmitting(true);
            trackerActor.send({
                type: "CREATE_TRACKED_ENTITY",
                trackedEntity: current,
            });
            // Success message will be shown after state machine confirms save
            setIsVisitModalOpen(false);
        } catch (error) {
            console.error("Error creating patient:", error);
            message.error({
                content: "Failed to register patient. Please try again.",
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

    const addPatient = () => {
        trackerActor.send({
            type: "RESET_TRACKED_ENTITY",
        });
        form.resetFields();
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(() => true);
    };
    return (
        <>
            <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={addPatient}
                style={{
                    background: "#52c41a",
                    borderColor: "#52c41a",
                    // height: "48px",
                    fontSize: "18px",
                    fontWeight: 500,
                    padding: "0 40px",
                    // borderRadius: "6px",
                    // marginTop: "8px",
                }}
                disabled={!programOrgUnits.has(orgUnit)}
            >
                New patient
            </Button>
            <Modal
                key={modalKey}
                open={isVisitModalOpen}
                onCancel={() => {
                    form.resetFields();
                    setIsVisitModalOpen(false);
                }}
                centered
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
                            Patient Registration
                        </Text>
                    </Flex>
                }
                width="85vw"
                footer={
                    <Flex
                        justify="end"
                        gap="middle"
                        style={{ padding: "8px 0" }}
                    >
                        <Button
                            onClick={() => {
                                form.resetFields();
                                setIsVisitModalOpen(false);
                            }}
                            style={{ borderRadius: 8 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
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
                            Register Patient
                        </Button>
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
                    initialValues={trackedEntity.attributes}
                >
                    <Flex vertical gap={10}>
                        {program.programSections.map(
                            ({ name, trackedEntityAttributes: tei, id }) => (
                                <Card
                                    title={name}
                                    key={id}
                                    style={{ borderRadius: 0 }}
                                    size="small"
                                >
                                    <Row gutter={[16, 0]}>
                                        {tei.map(({ id }) => {
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
                                                    span={spans.get(id) || 6}
                                                    form={form}
                                                    desktopRenderType={
                                                        desktopRenderType?.type
                                                    }
                                                    onTriggerProgramRules={
                                                        handleTriggerProgramRules
                                                    }
                                                />
                                            );
                                        })}
                                    </Row>
                                </Card>
                            ),
                        )}
                    </Flex>
                </Form>
            </Modal>
        </>
    );
};
