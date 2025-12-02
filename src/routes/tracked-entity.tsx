import {
    CalendarOutlined,
    CaretRightOutlined,
    EyeOutlined,
    MedicineBoxOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import type { DescriptionsProps, TableProps } from "antd";
import {
    Button,
    Card,
    Col,
    Collapse,
    DatePicker,
    Descriptions,
    Flex,
    Form,
    Modal,
    Row,
    Select,
    Space,
    Splitter,
    Table,
    Tabs,
    Tag,
    Typography,
} from "antd";
import dayjs from "dayjs";
import { set } from "lodash";
import React, { useEffect, useState } from "react";
import { DataElementField } from "../components/data-element-field";
import { ProgramStageCapture } from "../components/program-stage-capture";
import { TrackerContext } from "../machines/tracker";
import { ProgramRuleResult } from "../schemas";
import {
    createEmptyEvent,
    createGetValueProps,
    createNormalize,
    executeProgramRules,
    flattenTrackedEntity,
} from "../utils/utils";
import { RootRoute } from "./__root";
import { Spinner } from "../components/Spinner";
export const TrackedEntityRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entity/$trackedEntity",
    component: TrackedEntity,
});

const { Text } = Typography;

function TrackedEntity() {
    const {
        program,
        serviceTypes,
        programRuleVariables,
        programRules,
        allDataElements,
    } = RootRoute.useLoaderData();
    const trackerActor = TrackerContext.useActorRef();
    const attributes = TrackerContext.useSelector(
        (state) => state.context.trackedEntity?.attributes,
    );
    const enrollment = TrackerContext.useSelector(
        (state) => state.context.trackedEntity.enrollment,
    );
    const events = TrackerContext.useSelector((state) =>
        state.context.trackedEntity.events.filter(
            (e) => e.programStage === "K2nxbE9ubSs",
        ),
    );

    const mainEvent = TrackerContext.useSelector(
        (state) => state.context.mainEvent,
    );
    const isLoading = TrackerContext.useSelector((state) =>
        state.matches("loadingEntity"),
    );

    const keys: Map<string, string> = new Map(
        program.programTrackedEntityAttributes.map((attr) => [
            attr.trackedEntityAttribute.id,
            attr.trackedEntityAttribute.displayFormName ||
                attr.trackedEntityAttribute.name ||
                "",
        ]),
    );

    const [visitForm] = Form.useForm();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

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
            attributeValues: attributes,
        });

        setRuleResult(result);

        for (const [key, value] of Object.entries(result.assignments)) {
            visitForm.setFieldValue(key, value);
        }
    };

    const onVisitSubmit = (values: Record<string, any>) => {
        const { occurredAt, ...dataValues } = values;
        const event: ReturnType<typeof flattenTrackedEntity>["events"][number] =
            {
                ...mainEvent,
                occurredAt,
                dataValues: { ...mainEvent.dataValues, ...dataValues },
            };
        trackerActor.send({
            type: "CREATE_OR_UPDATE_EVENT",
            event,
        });
        trackerActor.send({ type: "SAVE_EVENTS" });
        setIsVisitModalOpen(false);
        visitForm.resetFields();
    };

    const showVisitModal = (
        visit: ReturnType<typeof flattenTrackedEntity>["events"][number],
    ) => {
        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: visit });
        setIsVisitModalOpen(true);
    };

    const handleModalClose = () => {
        setIsVisitModalOpen(false);
        visitForm.resetFields();
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
            title: "Services",
            dataIndex: ["dataValues", "mrKZWf2WMIC"],
            key: "services",
            render: (text) => (
                <Flex gap="small" align="center" wrap>
                    {text.split(",").map((tag) => {
                        return (
                            <Tag key={tag} color="blue">
                                {tag.toUpperCase()}
                            </Tag>
                        );
                    })}
                </Flex>
            ),
        },
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

    const items: DescriptionsProps["items"] = Object.entries(
        attributes || {},
    ).map(([key, value]) => ({
        label: keys.get(key) || key,
        children: <Text>{String(value)}</Text>,
    }));

    const handleValuesChange = (_changed: any, allValues: any) => {
        evaluateRules(allValues);
    };

    useEffect(() => {
        visitForm.resetFields();
        if (
            mainEvent &&
            mainEvent.dataValues &&
            Object.keys(mainEvent.dataValues).length > 0
        ) {
            const formValues = {
                occurredAt: mainEvent.occurredAt,
                ...Object.entries(mainEvent.dataValues).reduce(
                    (acc, [key, value]) => {
                        set(acc, key, value);
                        return acc;
                    },
                    {},
                ),
            };
            setTimeout(() => {
                visitForm.setFieldsValue(formValues);
                evaluateRules(formValues);
            }, 0);
        } else {
            evaluateRules(mainEvent?.dataValues || {});
        }
    }, [open, mainEvent]);

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <>
            <Splitter style={{ height: "calc(100vh - 48px)" }}>
                <Splitter.Panel style={{ padding: 10 }}>
                    <Flex vertical gap="16px">
                        <Flex>
                            <Button
                                onClick={() =>
                                    trackerActor.send({ type: "GO_BACK" })
                                }
                            >
                                Back
                            </Button>
                        </Flex>
                        <Card
                            title={
                                <Space>
                                    <CalendarOutlined />
                                    <span>Patient Visits</span>
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
                                                trackedEntity:
                                                    enrollment.trackedEntity,
                                                enrollment:
                                                    enrollment.enrollment,
                                                orgUnit: enrollment.orgUnit,
                                                programStage: "K2nxbE9ubSs",
                                            }),
                                        );
                                    }}
                                >
                                    Add Visit
                                </Button>
                            }
                            // styles={{ body: { padding: 0, margin: 0 } }}
                        >
                            <Table
                                columns={columns}
                                dataSource={events}
                                pagination={false}
                                rowKey="event"
                            />
                        </Card>
                    </Flex>
                </Splitter.Panel>

                <Splitter.Panel
                    defaultSize="25%"
                    collapsible={{
                        start: true,
                        end: true,
                        showCollapsibleIcon: true,
                    }}
                    style={{ padding: 10 }}
                >
                    <Flex vertical gap="16px">
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "2",
                                    label: "Notes about this enrollment",
                                    children: <p></p>,
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                        />
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "1",
                                    label: "Person Profile",
                                    children: (
                                        <Descriptions
                                            bordered
                                            column={1}
                                            items={items}
                                        />
                                    ),
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                            styles={{ body: { padding: 0, margin: 0 } }}
                        />
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "2",
                                    label: "Enrollment",
                                    children: (
                                        <Descriptions
                                            column={1}
                                            items={[
                                                {
                                                    label: "Enrollment Date",
                                                    children: (
                                                        <Text>
                                                            {
                                                                enrollment?.enrolledAt
                                                            }
                                                        </Text>
                                                    ),
                                                },
                                                {
                                                    label: "Status",
                                                    children: (
                                                        <Text>
                                                            {enrollment?.status}
                                                        </Text>
                                                    ),
                                                },
                                            ]}
                                        />
                                    ),
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                        />
                    </Flex>
                </Splitter.Panel>
            </Splitter>
            <Modal
                title={
                    <Space>
                        <MedicineBoxOutlined />
                        <span>"Visit Details"</span>
                    </Space>
                }
                open={isVisitModalOpen}
                onCancel={handleModalClose}
                footer={[
                    <Button key="cancel" onClick={handleModalClose}>
                        Cancel
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => visitForm.submit()}
                    >
                        {"Update/Create Visit"}
                    </Button>,
                ]}
                width="90vw"
                styles={{
                    body: {
                        height: "70vh",
                        margin: 0,
                        padding: 0,
                    },
                }}
            >
                <Form
                    form={visitForm}
                    layout="vertical"
                    onFinish={onVisitSubmit}
                    onValuesChange={handleValuesChange}
                    initialValues={{
                        ...mainEvent.dataValues,
                        occurredAt: mainEvent.occurredAt,
                    }}
                    style={{ margin: 0, padding: 0 }}
                >
                    <Flex vertical style={{ padding: 12 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    label="Visit Date"
                                    name="occurredAt"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please select visit date!",
                                        },
                                    ]}
                                    getValueProps={createGetValueProps("DATE")}
                                    normalize={createNormalize("DATE")}
                                >
                                    <DatePicker style={{ width: "100%" }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    label="Service Type"
                                    name="mrKZWf2WMIC"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please select service type!",
                                        },
                                    ]}
                                    getValueProps={createGetValueProps(
                                        "MULTI_TEXT",
                                    )}
                                    normalize={createNormalize("MULTI_TEXT")}
                                >
                                    <Select
                                        style={{ width: "100%" }}
                                        options={serviceTypes}
                                        value
                                        fieldNames={{
                                            label: "name",
                                            value: "code",
                                        }}
                                        mode="multiple"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Tabs
                            tabPlacement="start"
                            items={program.programStages.flatMap((stage) => {
                                if (
                                    [
                                        "opwSN351xGC",
                                        "zKGWob5AZKP",
                                        "DA0Yt3V16AN",
                                    ].indexOf(stage.id) !== -1
                                ) {
                                    return {
                                        key: stage.id,
                                        label: stage.name,
                                        children: (
                                            <ProgramStageCapture
                                                programStage={stage}
                                            />
                                        ),
                                    };
                                }
                                return stage.programStageSections.flatMap(
                                    (section) => {
                                        if (
                                            ruleResult.hiddenSections.has(
                                                section.id,
                                            )
                                        )
                                            return [];

                                        return [
                                            {
                                                key: `${stage.id}-${section.id}`,
                                                label:
                                                    section.displayName ||
                                                    section.name,
                                                children: (
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
                                                                                ]?.has(
                                                                                    o.id,
                                                                                )
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
                                                                        hidden={ruleResult.hiddenFields.has(
                                                                            dataElement.id,
                                                                        )}
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
                                                                            )
                                                                                ?.vertical ??
                                                                            false
                                                                        }
                                                                        finalOptions={
                                                                            finalOptions
                                                                        }
                                                                    />
                                                                );
                                                            },
                                                        )}
                                                    </Row>
                                                ),
                                            },
                                        ];
                                    },
                                );
                            })}
                            styles={{
                                content: {
                                    height: "62vh",
                                    overflow: "auto",
                                    padding: 12,
                                    margin: 0,
                                },
                                header: {
                                    height: "62vh",
                                    overflow: "auto",
                                },
                            }}
                        />
                    </Flex>
                </Form>
            </Modal>
        </>
    );
}
