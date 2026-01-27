import {
    CalendarOutlined,
    DashboardOutlined,
    MoreOutlined,
    ScheduleOutlined,
    UserOutlined,
} from "@ant-design/icons";
import {
    Button,
    Card,
    Col,
    Dropdown,
    Flex,
    Form,
    Layout,
    MenuProps,
    Row,
    Space,
    Statistic,
    Table,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import React from "react";
import { FlattenedTrackedEntity } from "../db";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { TrackedEntitiesRoute } from "../routes/tracked-entities";
import { DataElementField } from "./data-element-field";
import NoPatientsCard from "./no-patient-card";
import { TrackerRegistration } from "./tracker-registration";

const { Content } = Layout;
const { Title, Text } = Typography;

const MedicalRegistry: React.FC = () => {
    const [form] = Form.useForm();

    const { program, trackedEntityAttributes, optionSets } =
        RootRoute.useLoaderData();
    const { total, enrollments, appointments } =
        TrackedEntitiesRoute.useLoaderData();
    const trackedEntities = TrackerContext.useSelector(
        (state) => state.context.trackedEntities,
    );
    const trackerActor = TrackerContext.useActorRef();

    const actionMenu: MenuProps = {
        items: [
            {
                key: "dashboard",
                label: "Patient Dashboard",
                icon: <DashboardOutlined />,
            },
            {
                key: "patient",
                label: "Patient Summary",
                icon: <UserOutlined />,
            },
        ],
    };
    const columns: ColumnsType<FlattenedTrackedEntity> = [
        {
            displayInList: true,
            displayFormName: "Registering Facility",
            name: "Registering Facility",
            id: "registeringFacility",
            valueType: "TEXT",
            optionSetValue: false,
            generated: false,
            unique: false,
            pattern: "",
            confidential: false,
        },
        ...program.programTrackedEntityAttributes.map(
            ({ trackedEntityAttribute: { id }, ...rest }) => ({
                ...rest,
                ...trackedEntityAttributes.get(id)!,
            }),
        ),
        {
            displayInList: true,
            displayFormName: "Actions",
            name: "Actions",
            id: "actions",
            valueType: "TEXT",
            optionSetValue: false,
            generated: false,
            unique: false,
            pattern: "",
            confidential: false,
        },
    ].flatMap((trackedEntityAttribute) => {
        if (!trackedEntityAttribute.displayInList) {
            return [];
        }

        if (trackedEntityAttribute.id === "registeringFacility") {
            return {
                title:
                    trackedEntityAttribute.displayFormName ||
                    trackedEntityAttribute.name,
                key: trackedEntityAttribute.id,
                render: (record) => {
                    console.log("record in registeringFacility column", record);
                    return record.enrollment?.orgUnitName || "N/A";
                },
            };
        }

        if (trackedEntityAttribute.id === "actions") {
            return {
                title: "Action",
                key: "action",
                fixed: "right",
                width: 100,
                render: (_, record) => (
                    <Dropdown menu={actionMenu} trigger={["click"]}>
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            style={{
                                color: "#666",
                                fontSize: 20,
                            }}
                        />
                    </Dropdown>
                ),
            };
        }

        return {
            title:
                trackedEntityAttribute.displayFormName ||
                trackedEntityAttribute.name,
            dataIndex: ["attributes", trackedEntityAttribute.id],
            key: trackedEntityAttribute.id,
        };
    });

    const handleClear = () => {
        form.resetFields();
        trackerActor.send({
            type: "SEARCH",
            search: {
                filters: {},
            },
        });
    };

    const onStageSubmit = (values: any) => {
        trackerActor.send({
            type: "SEARCH",
            search: {
                filters: Object.entries(values).reduce((acc, [key, value]) => {
                    if (value !== undefined && value !== null && value !== "") {
                        acc[key] = [value];
                    }
                    return acc;
                }, {}),
            },
        });
    };

    return (
        <Content
            style={{
                padding: "16px",
            }}
        >
            <Row gutter={[8, 8]}>
                <Col xs={24} lg={8}>
                    <Card
                        title={<Title level={4}>Search patient</Title>}
                        variant="borderless"
                        style={{ height: "100%" }}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={onStageSubmit}
                            style={{ margin: 0, padding: 0 }}
                        >
                            <Row gutter={[0, 0]}>
                                {program.programTrackedEntityAttributes.flatMap(
                                    ({
                                        trackedEntityAttribute: { id },
                                        searchable,
                                    }) => {
                                        if (!searchable) {
                                            return [];
                                        }
                                        const current =
                                            trackedEntityAttributes.get(id)!;

                                        const optionSet =
                                            current.optionSet?.id ?? "";

                                        const finalOptions =
                                            optionSets.get(optionSet) ?? [];

                                        return (
                                            <DataElementField
                                                key={id}
                                                dataElement={current}
                                                hidden={false}
                                                finalOptions={finalOptions}
                                                messages={[]}
                                                warnings={[]}
                                                errors={[]}
                                                required={false}
                                                span={24}
                                                form={form}
                                                onTriggerProgramRules={() => {}}
                                                onAutoSave={() => {}}
                                            />
                                        );
                                    },
                                )}
                                <Col span={24}>
                                    <Flex align="center" gap={20}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                        >
                                            Search
                                        </Button>
                                        <Button onClick={handleClear}>
                                            Clear
                                        </Button>
                                    </Flex>
                                </Col>
                            </Row>
                        </Form>
                    </Card>
                </Col>
                <Col xs={24} lg={16}>
                    <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
                        <Col xs={24} sm={8}>
                            <Card variant="borderless">
                                <Statistic
                                    title="Total Patients"
                                    value={total}
                                    prefix={<UserOutlined />}
                                    styles={{
                                        content: { color: "#1f4788" },
                                    }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card variant="borderless">
                                <Statistic
                                    title="Registered Today"
                                    value={enrollments}
                                    prefix={<CalendarOutlined />}
                                    styles={{
                                        content: { color: "#52c41a" },
                                    }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card variant="borderless">
                                <Statistic
                                    title="Upcoming Appointments"
                                    value={appointments}
                                    prefix={<ScheduleOutlined />}
                                    styles={{
                                        content: { color: "#faad14" },
                                    }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {trackedEntities.length === 0 ? (
                        <NoPatientsCard />
                    ) : (
                        <Card
                            variant="borderless"
                            extra={
                                <Space>
                                    <Text>
                                        {`${trackedEntities.length} results matching: '${Object.values(
                                            form.getFieldsValue(),
                                        )
                                            .flatMap((v) => (v ? [v] : []))
                                            .join(", ")}'`}
                                    </Text>
                                    <TrackerRegistration />
                                </Space>
                            }
                        >
                            <Space
                                orientation="vertical"
                                size="middle"
                                style={{ width: "100%" }}
                            >
                                <Text type="secondary">
                                    {trackedEntities.length} patients found (5
                                    of {total} total)
                                </Text>

                                <Table
                                    columns={columns}
                                    dataSource={trackedEntities}
                                    rowKey="trackedEntity"
                                    pagination={{
                                        pageSize: 5,
                                        showSizeChanger: true,
                                        total: 5,
                                        showTotal: (total, range) =>
                                            `Showing ${range[0]} to ${range[1]} of ${total}`,
                                    }}
                                    onRow={(record) => {
                                        return {
                                            onClick: () => {
                                                trackerActor.send({
                                                    type: "SET_TRACKED_ENTITY",
                                                    trackedEntity: record,
                                                });
                                            },
                                            style: { cursor: "pointer" },
                                        };
                                    }}
                                    scroll={{ x: "max-content" }}
                                />
                            </Space>
                        </Card>
                    )}
                </Col>
            </Row>
        </Content>
    );
};

export default MedicalRegistry;
