import {
    CalendarOutlined,
    CaretRightOutlined,
    MedicineBoxOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import type { DescriptionsProps, TableProps } from "antd";
import {
    Button,
    Card,
    Checkbox,
    Col,
    Collapse,
    DatePicker,
    Descriptions,
    Flex,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Row,
    Select,
    Space,
    Splitter,
    Table,
    Tabs,
    Typography,
} from "antd";
import dayjs from "dayjs";
import React, { Children, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { executeProgramRules, flattenTrackedEntity } from "../utils/utils";
import { RootRoute } from "./__root";
import { ProgramRuleResult } from "../schemas";
export const TrackedEntityRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entity/$trackedEntity",
    component: TrackedEntity,
});

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const isDate = (valueType: string | undefined) => {
    return (
        valueType === "DATE" ||
        valueType === "DATETIME" ||
        valueType === "TIME" ||
        valueType === "AGE"
    );
};

function TrackedEntity() {
    const { program, serviceTypes, programRuleVariables, programRules } =
        RootRoute.useLoaderData();
    const attributes = TrackerContext.useSelector(
        (state) => state.context.trackedEntity?.attributes,
    );
    const enrollment = TrackerContext.useSelector(
        (state) => state.context.trackedEntity?.enrollment,
    );
    const events = TrackerContext.useSelector(
        (state) => state.context.trackedEntity?.events,
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
    const [loading, setLoading] = useState(false);
    const [visits, setVisits] = useState([
        {
            key: "1",
            date: "2024-11-20",
            reason: "Regular Checkup",
            doctor: "Dr. Smith",
            status: "Completed",
        },
        {
            key: "2",
            date: "2024-10-15",
            reason: "Follow-up",
            doctor: "Dr. Johnson",
            status: "Completed",
        },
    ]);
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null);

    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>({
        hiddenFields: new Set<string>(),
        assignments: {},
        messages: [],
        warnings: [],
        shownFields: new Set<string>(),
        hiddenSections: new Set<string>(),
        shownSections: new Set<string>(),
    });

    const evaluateRules = (dataValues: any) => {
        console.log("Evaluating rules with data values:", dataValues);
        const result = executeProgramRules({
            programRules: programRules.programRules,
            programRuleVariables: programRuleVariables.programRuleVariables,
            dataValues,
        });

        console.log("Rule evaluation result:", result);
        setRuleResult(result);
        // Apply ASSIGN actions to the form
        for (const [key, value] of Object.entries(result.assignments)) {
            visitForm.setFieldValue(key, value);
        }
    };

    const onPatientSubmit = async (values) => {
        setLoading(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            console.log("Patient info:", values);
            message.success("Patient information saved successfully!");
        } catch (error) {
            message.error("Failed to save patient information.");
        } finally {
            setLoading(false);
        }
    };

    const onVisitSubmit = async (values) => {
        try {
            const newVisit = {
                key: String(visits.length + 1),
                date: values.date.format("YYYY-MM-DD"),
                reason: values.reason,
                doctor: values.doctor,
                status: values.status,
                diagnosis: values.diagnosis,
                treatment: values.treatment,
                notes: values.notes,
            };
            setVisits([newVisit, ...visits]);
            message.success("Visit added successfully!");
            setIsVisitModalOpen(false);
            visitForm.resetFields();
        } catch (error) {
            message.error("Failed to add visit.");
        }
    };

    const showVisitModal = (visit = null) => {
        setSelectedVisit(visit);
        // if (visit) {
        //     visitForm.setFieldsValue({
        //         date: dayjs(visit.date),
        //         reason: visit.reason,
        //         doctor: visit.doctor,
        //         status: visit.status,
        //         diagnosis: visit.diagnosis,
        //         treatment: visit.treatment,
        //         notes: visit.notes,
        //     });
        // }
        setIsVisitModalOpen(true);
    };

    const handleModalClose = () => {
        setIsVisitModalOpen(false);
        setSelectedVisit(null);
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
        // {
        //     title: "Action",
        //     key: "action",
        //     render: (_, record) => (
        //         <Button
        //             icon={<EyeOutlined />}
        //             onClick={() => showVisitModal(record)}
        //         >
        //             View
        //         </Button>
        //     ),
        // },
    ];

    const items: DescriptionsProps["items"] = Object.entries(
        attributes || {},
    ).map(([key, value]) => ({
        label: keys.get(key) || key,
        children: <Text>{String(value)}</Text>,
    }));

    const handleValuesChange = (_changed: any, allValues: any) => {
        console.log("Values changed:", allValues);
        evaluateRules(allValues);
    };
    return (
        <>
            <Splitter style={{ height: "calc(100vh - 48px)" }}>
                <Splitter.Panel style={{ padding: 10 }}>
                    <Flex vertical gap="16px">
                        <Descriptions bordered column={3} items={items} />
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
                                    onClick={() => showVisitModal()}
                                >
                                    Add Visit
                                </Button>
                            }
                            styles={{ body: { padding: 0, margin: 0 } }}
                        >
                            <Table
                                columns={columns}
                                dataSource={events}
                                pagination={{ pageSize: 10 }}
                                rowKey="event"
                            />
                        </Card>
                    </Flex>
                </Splitter.Panel>

                <Splitter.Panel
                    defaultSize="40%"
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
                        <span>
                            {selectedVisit ? "Visit Details" : "Add New Visit"}
                        </span>
                    </Space>
                }
                open={isVisitModalOpen}
                onCancel={handleModalClose}
                footer={
                    selectedVisit
                        ? [
                              <Button key="close" onClick={handleModalClose}>
                                  Close
                              </Button>,
                          ]
                        : [
                              <Button key="cancel" onClick={handleModalClose}>
                                  Cancel
                              </Button>,
                              <Button
                                  key="submit"
                                  type="primary"
                                  onClick={() => visitForm.submit()}
                              >
                                  Add Visit
                              </Button>,
                          ]
                }
                width="80vw"
                styles={{
                    body: {
                        maxHeight: "70vh",
                        overflow: "auto",
                        padding: 0,
                        margin: 0,
                    },
                }}
            >
                <Form
                    form={visitForm}
                    layout="vertical"
                    onFinish={onVisitSubmit}
                    disabled={!!selectedVisit}
                    onValuesChange={handleValuesChange}
                    style={{ margin: 0, padding: 0 }}
                >
                    <Flex vertical style={{ padding: 12 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    label="Visit Date"
                                    name="date"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please select visit date!",
                                        },
                                    ]}
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
                                                        {section.dataElements.map(
                                                            (dataElement) => {
                                                                if (
                                                                    ruleResult.hiddenFields.has(
                                                                        dataElement.id,
                                                                    )
                                                                )
                                                                    return null;
                                                                let element: React.ReactNode =
                                                                    <Input />;

                                                                if (
                                                                    dataElement.optionSetValue &&
                                                                    dataElement.optionSet
                                                                ) {
                                                                    element = (
                                                                        <Select
                                                                            options={dataElement.optionSet.options.map(
                                                                                (
                                                                                    o,
                                                                                ) => ({
                                                                                    label: o.name,
                                                                                    value: o.code,
                                                                                }),
                                                                            )}
                                                                            allowClear
                                                                            mode={
                                                                                dataElement.valueType ===
                                                                                "MULTI_TEXT"
                                                                                    ? "multiple"
                                                                                    : undefined
                                                                            }
                                                                        />
                                                                    );
                                                                } else if (
                                                                    dataElement.valueType ===
                                                                    "BOOLEAN"
                                                                ) {
                                                                    element = (
                                                                        <Checkbox>
                                                                            {dataElement.formName ??
                                                                                dataElement.name}
                                                                        </Checkbox>
                                                                    );
                                                                } else if (
                                                                    dataElement.valueType ===
                                                                        "DATE" ||
                                                                    dataElement.valueType ===
                                                                        "DATETIME" ||
                                                                    dataElement.valueType ===
                                                                        "TIME" ||
                                                                    dataElement.valueType ===
                                                                        "AGE"
                                                                ) {
                                                                    element = (
                                                                        <DatePicker
                                                                            style={{
                                                                                width: "100%",
                                                                            }}
                                                                        />
                                                                    );
                                                                } else if (
                                                                    dataElement.valueType ===
                                                                    "LONG_TEXT"
                                                                ) {
                                                                    element = (
                                                                        <Input.TextArea
                                                                            rows={
                                                                                4
                                                                            }
                                                                        />
                                                                    );
                                                                } else if (
                                                                    [
                                                                        "NUMBER",
                                                                        "INTEGER",
                                                                        "INTEGER_POSITIVE",
                                                                    ].includes(
                                                                        dataElement.valueType ??
                                                                            "",
                                                                    )
                                                                ) {
                                                                    element = (
                                                                        <InputNumber
                                                                            style={{
                                                                                width: "100%",
                                                                            }}
                                                                        />
                                                                    );
                                                                }

                                                                return (
                                                                    <Col
                                                                        span={8}
                                                                        key={
                                                                            dataElement.id
                                                                        }
                                                                    >
                                                                        <Form.Item
                                                                            key={
                                                                                dataElement.id
                                                                            }
                                                                            label={
                                                                                dataElement.valueType ===
                                                                                "BOOLEAN"
                                                                                    ? null
                                                                                    : `${
                                                                                          dataElement.formName ||
                                                                                          dataElement.name
                                                                                      } ${dataElement.valueType}`
                                                                            }
                                                                            name={
                                                                                dataElement.id
                                                                            }
                                                                            getValueProps={
                                                                                isDate(
                                                                                    dataElement?.valueType,
                                                                                )
                                                                                    ? (
                                                                                          value,
                                                                                      ) =>
                                                                                          isDate(
                                                                                              dataElement?.valueType,
                                                                                          )
                                                                                              ? {
                                                                                                    value: value
                                                                                                        ? dayjs(
                                                                                                              value,
                                                                                                          )
                                                                                                        : null,
                                                                                                }
                                                                                              : {}
                                                                                    : undefined
                                                                            }
                                                                            normalize={(
                                                                                value,
                                                                            ) =>
                                                                                isDate(
                                                                                    dataElement?.valueType,
                                                                                ) &&
                                                                                dayjs.isDayjs(
                                                                                    value,
                                                                                )
                                                                                    ? value.format(
                                                                                          "YYYY-MM-DD",
                                                                                      )
                                                                                    : value
                                                                            }
                                                                        >
                                                                            {
                                                                                element
                                                                            }
                                                                        </Form.Item>
                                                                    </Col>
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
                        />
                    </Flex>
                </Form>
            </Modal>
        </>
    );
}

{
    /* <Row gutter={16}>
    <Col xs={24} sm={24}>
        <Form.Item
            label="Visit Date"
            name="date"
            rules={[
                {
                    required: true,
                    message: "Please select visit date!",
                },
            ]}
        >
            <DatePicker style={{ width: "100%" }} />
        </Form.Item>
    </Col>
</Row>; */
}
