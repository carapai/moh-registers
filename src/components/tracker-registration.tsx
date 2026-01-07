import { UserAddOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Form, message, Modal, Row, Typography } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { DataElementField } from "./data-element-field";
import { RootRoute } from "../routes/__root";
import { flattenTrackedEntity } from "../utils/utils";

const { Text } = Typography;

export const TrackerRegistration: React.FC = () => {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRuleVariables,
        programRules,
    } = RootRoute.useLoaderData();
    const allAttributes: Map<string, boolean> = new Map(
        program.programTrackedEntityAttributes.map(
            ({ mandatory, trackedEntityAttribute: { id } }) => [id, mandatory],
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

    const fields = useMemo(() => {
        return Object.entries(trackedEntity.attributes || {}).map(
            ([name, value]) => ({
                name,
                value,
            }),
        );
    }, []);

    const handleValuesChange = (_changed: any, allValues: any) => {
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            attributeValues: allValues,
            programRules: programRules,
            programRuleVariables: programRuleVariables,
        });
        trackerActor.send({
            type: "UPDATE_DATA_WITH_ASSIGNMENTS",
        });
    };

    useEffect(() => {
        if (isVisitModalOpen) {
            trackerActor.send({
                type: "EXECUTE_PROGRAM_RULES",
                attributeValues: trackedEntity.attributes,
                programRules: programRules,
                programRuleVariables: programRuleVariables,
            });
            trackerActor.send({
                type: "UPDATE_DATA_WITH_ASSIGNMENTS",
            });
        }
    }, [isVisitModalOpen]);

    // Listen for state machine transitions and show appropriate messages
    // Only show success message if we were actually submitting
    useEffect(() => {
        if (machineState === "entitySuccess" && isSubmitting) {
            message.success({
                content: "Patient registered successfully!",
                duration: 3,
            });
            setIsSubmitting(false);
        } else if (machineState === "failure" && isSubmitting) {
            message.error({
                content: "Failed to save patient. Please try again.",
                duration: 5,
            });
            setIsSubmitting(false);
        }
    }, [machineState, isSubmitting]);

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
            // ✅ Machine will automatically navigate to patient detail page
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
        // trackerActor.send({
        //     type: "RESET_TRACKED_ENTITY",
        // });
        console.log(
            "Resetting form for new patient registration",
            trackedEntity,
        );
        form.resetFields();
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(() => true);
    };
    return (
        <>
            <Button
                type="primary"
                icon={<UserAddOutlined />}
                style={{
                    background:
                        "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                    // borderColor: "#7c3aed",
                    // borderRadius: 8,
                    fontWeight: 500,
                    // boxShadow: "0 2px 4px rgba(124, 58, 237, 0.2)",
                }}
                onClick={addPatient}
            >
                Register New Patient
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
                    onValuesChange={handleValuesChange}
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

                                            return (
                                                <DataElementField
                                                    key={id}
                                                    dataElement={current}
                                                    hidden={false}
                                                    renderOptionsAsRadio={false}
                                                    vertical={false}
                                                    finalOptions={finalOptions}
                                                    messages={messages}
                                                    warnings={warnings}
                                                    errors={errors}
                                                    required={
                                                        allAttributes.get(id) ||
                                                        false
                                                    }
                                                    span={6}
                                                    form={form}
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
