import { MedicineBoxOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Form, Modal, Row, Space } from "antd";
import { set } from "lodash";
import React, { useEffect, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { ProgramRuleResult } from "../schemas";
import { executeProgramRules } from "../utils/utils";
import { DataElementField } from "./data-element-field";

export const TrackerRegistration: React.FC = () => {
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

    const [form] = Form.useForm();
    const { programRuleVariables, programRules } = RootRoute.useLoaderData();
    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    const programTrackedEntityAttributes = TrackerContext.useSelector(
        (state) => state.context.programTrackedEntityAttributes,
    );

    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>({
        hiddenFields: new Set<string>(),
        assignments: {},
        messages: [],
        warnings: [],
        errors: [],
        shownFields: new Set<string>(),
        hiddenSections: new Set<string>(),
        shownSections: new Set<string>(),
        hiddenOptionGroups: {},
        shownOptionGroups: {},
        hiddenOptions: {},
        shownOptions: {},
    });

    const evaluateRules = (attributeValues: any) => {
        const result = executeProgramRules({
            programRules: programRules.programRules,
            programRuleVariables: programRuleVariables.programRuleVariables,
            attributeValues,
        });

        console.log("Rule evaluation result:", result);

        setRuleResult(result);

        for (const [key, value] of Object.entries(result.assignments)) {
            form.setFieldValue(key, value);
        }
    };

    const handleValuesChange = (_changed: any, allValues: any) => {
        evaluateRules(allValues);
    };

    useEffect(() => {
        if (
            trackedEntity &&
            trackedEntity.attributes &&
            Object.keys(trackedEntity.attributes).length > 0
        ) {
            const formValues = {
                ...Object.entries(trackedEntity.attributes).reduce(
                    (acc, [key, value]) => {
                        set(acc, key, value);
                        return acc;
                    },
                    {},
                ),
            };
            setTimeout(() => {
                form.setFieldsValue(formValues);
                evaluateRules(formValues);
            }, 0);
        } else {
            evaluateRules(trackedEntity?.attributes || {});
        }
    }, []);
    return (
        <>
            <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{
                    backgroundColor: "#7c3aed",
                    borderColor: "#7c3aed",
                }}
                onClick={() => setIsVisitModalOpen(() => true)}
            >
                Add Patient
            </Button>
            <Modal
                open={isVisitModalOpen}
                // onCancel={() => setIsVisitModalOpen(false)}
                title={
                    <Space>
                        <MedicineBoxOutlined />
                        <span>Registration Details</span>
                    </Space>
                }
                width="80vw"
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setIsVisitModalOpen(false)}
                    >
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => form.submit()}
                    >
                        Add Record
                    </Button>,
                ]}
                styles={{
                    body: {
                        maxHeight: "80vh",
                        overflow: "auto",
                    },
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    // onFinish={onStageSubmit}
                    onValuesChange={handleValuesChange}
                    style={{ margin: 0, padding: 0 }}
                >
                    <Flex vertical style={{ padding: 12 }}>
                        <Row gutter={24}>
                            {programTrackedEntityAttributes.flatMap(
                                ({ trackedEntityAttribute, mandatory }) => {
                                    if (
                                        ruleResult.hiddenSections.has(
                                            trackedEntityAttribute.id,
                                        )
                                    )
                                        return [];
                                    const finalOptions =
                                        trackedEntityAttribute.optionSet?.options.flatMap(
                                            (o) => {
                                                if (
                                                    ruleResult.hiddenOptions[
                                                        trackedEntityAttribute
                                                            .id
                                                    ]?.has(o.id)
                                                ) {
                                                    return [];
                                                }
                                                return o;
                                            },
                                        );

                                    const errors = ruleResult.errors.filter(
                                        (msg) =>
                                            msg.key ===
                                            trackedEntityAttribute.id,
                                    );
                                    const messages = ruleResult.messages.filter(
                                        (msg) =>
                                            msg.key ===
                                            trackedEntityAttribute.id,
                                    );
                                    const warnings = ruleResult.warnings.filter(
                                        (msg) =>
                                            msg.key ===
                                            trackedEntityAttribute.id,
                                    );

                                    return (
                                        <DataElementField
                                            key={trackedEntityAttribute.id}
                                            dataElement={trackedEntityAttribute}
                                            hidden={false}
                                            renderOptionsAsRadio={false}
                                            vertical={false}
                                            finalOptions={finalOptions}
                                            messages={messages}
                                            warnings={warnings}
                                            errors={errors}
                                            required={mandatory}
                                        />
                                    );
                                },
                            )}
                        </Row>
                    </Flex>
                </Form>
            </Modal>
        </>
    );
};
