import { CalendarOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import {
    Button,
    Card,
    Flex,
    Form,
    Modal,
    Row,
    Space,
    Table,
    TableProps,
} from "antd";
import dayjs from "dayjs";
import { set } from "lodash";
import React, { useEffect, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { ProgramRuleResult, ProgramStage } from "../schemas";
import {
    createEmptyEvent,
    executeProgramRules,
    flattenTrackedEntity,
} from "../utils/utils";
import { DataElementField } from "./data-element-field";

export const ProgramStageCapture: React.FC<{
    programStage: ProgramStage;
}> = ({ programStage }) => {
    const [stageForm] = Form.useForm();
    const { allDataElements, programRuleVariables, programRules } =
        RootRoute.useLoaderData();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
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
        {
            title: "Action",
            key: "action",
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

    const onStageSubmit = (values: Record<string, any>) => {
        const event: ReturnType<typeof flattenTrackedEntity>["events"][number] =
            {
                ...currentEvent,
                occurredAt: mainEvent.occurredAt,
                dataValues: { ...currentEvent.dataValues, ...values },
            };
        trackerActor.send({
            type: "CREATE_OR_UPDATE_EVENT",
            event,
        });
        setIsVisitModalOpen(() => false);
    };

    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>({
        hiddenFields: new Set<string>(),
        assignments: {},
        messages: [],
        warnings: [],
        shownFields: new Set<string>(),
        hiddenSections: new Set<string>(),
        shownSections: new Set<string>(),
        hiddenOptionGroups: {},
        shownOptionGroups: {},
        hiddenOptions: {},
        shownOptions: {},
    });

    const evaluateRules = (dataValues: any) => {
        const result = executeProgramRules({
            programRules: programRules.programRules,
            programRuleVariables: programRuleVariables.programRuleVariables,
            dataValues,
        });

        setRuleResult(result);

        for (const [key, value] of Object.entries(result.assignments)) {
            stageForm.setFieldValue(key, value);
        }
    };

    const handleValuesChange = (_changed: any, allValues: any) => {
        evaluateRules(allValues);
    };

    useEffect(() => {
        stageForm.resetFields();
        if (
            currentEvent &&
            currentEvent.dataValues &&
            Object.keys(currentEvent.dataValues).length > 0
        ) {
            const formValues = {
                occurredAt: currentEvent.occurredAt,
                ...Object.entries(currentEvent.dataValues).reduce(
                    (acc, [key, value]) => {
                        set(acc, key, value);
                        return acc;
                    },
                    {},
                ),
            };
            setTimeout(() => {
                stageForm.setFieldsValue(formValues);
                evaluateRules(formValues);
            }, 0);
        } else {
            evaluateRules(currentEvent?.dataValues || {});
        }
    }, [open, currentEvent]);

    return (
        <Flex style={{ width: "100%" }}>
            <Card
                title={
                    <Space>
                        <CalendarOutlined />
                        <span>{programStage.name}</span>
                    </Space>
                }
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            showVisitModal(
                                createEmptyEvent({
                                    program: enrollment.program,
                                    trackedEntity: enrollment.trackedEntity,
                                    enrollment: enrollment.enrollment,
                                    orgUnit: enrollment.orgUnit,
                                    programStage: programStage.id,
                                }),
                            );
                        }}
                    >
                        Add Record
                    </Button>
                }
                styles={{
                    body: {
                        padding: 0,
                        margin: 0,
                    },
                }}
                style={{ width: "100%" }}
            >
                <Table
                    columns={columns}
                    dataSource={events}
                    pagination={{ pageSize: 10 }}
                    rowKey="event"
                />
            </Card>
            <Modal
                open={isVisitModalOpen}
                // onCancel={() => setIsVisitModalOpen(false)}
                width="60vw"
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
                        onClick={() => stageForm.submit()}
                    >
                        Add Record
                    </Button>,
                ]}
                styles={{
                    body: {
                        maxHeight: "70vh",
                        overflow: "auto",
                    },
                }}
            >
                <Form
                    form={stageForm}
                    layout="vertical"
                    onFinish={onStageSubmit}
                    onValuesChange={handleValuesChange}
                    style={{ margin: 0, padding: 0 }}
                >
                    <Flex vertical style={{ padding: 24 }}>
                        {programStage.programStageSections.flatMap(
                            (section) => {
                                if (ruleResult.hiddenSections.has(section.id))
                                    return [];

                                return (
                                    <Row gutter={24}>
                                        {section.dataElements.flatMap(
                                            (dataElement) => {
                                                if (
                                                    ruleResult.hiddenFields.has(
                                                        dataElement.id,
                                                    )
                                                ) {
                                                    return [];
                                                }

                                                const finalOptions =
                                                    dataElement.optionSet?.options.flatMap(
                                                        (o) => {
                                                            if (
                                                                ruleResult.hiddenOptions[
                                                                    dataElement
                                                                        .id
                                                                ]?.has(o.id)
                                                            ) {
                                                                return [];
                                                            }
                                                            return o;
                                                        },
                                                    );

                                                return (
                                                    <DataElementField
                                                        dataElement={
                                                            dataElement
                                                        }
                                                        hidden={false}
                                                        renderOptionsAsRadio={
                                                            allDataElements.get(
                                                                dataElement.id,
                                                            )
                                                                ?.renderOptionsAsRadio ??
                                                            false
                                                        }
                                                        vertical={
                                                            allDataElements.get(
                                                                dataElement.id,
                                                            )?.vertical ?? false
                                                        }
                                                        finalOptions={
                                                            finalOptions
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
