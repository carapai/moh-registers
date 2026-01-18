import {
    CalendarOutlined,
    DashboardOutlined,
    MoreOutlined,
    ScheduleOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons";
import {
    Button,
    Card,
    Col,
    Divider,
    Dropdown,
    Input,
    Layout,
    MenuProps,
    Row,
    Space,
    Statistic,
    Table,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { flattenTrackedEntityResponse } from "../utils/utils";
import NoPatientsCard from "./no-patient-card";
import { TrackerRegistration } from "./tracker-registration";
import { TrackedEntitiesRoute } from "../routes/tracked-entities";

const { Content } = Layout;
const { Title, Text } = Typography;

const MedicalRegistry: React.FC = () => {
    const { program, trackedEntityAttributes } = RootRoute.useLoaderData();
    const { total, enrollments, appointments } =
        TrackedEntitiesRoute.useLoaderData();
    const [search, setSearch] = useState<Record<string, any>>({});
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
    const columns: ColumnsType<
        ReturnType<typeof flattenTrackedEntityResponse>[number]
    > = [
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

    const handleSearch = () => {
        trackerActor.send({
            type: "SEARCH",
            search: {
                filters: search,
            },
        });
    };

    const handleClear = () => {
        setSearch({});
        trackerActor.send({
            type: "SEARCH",
            search: {
                filters: {},
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
                        <Space
                            orientation="vertical"
                            size="middle"
                            style={{ width: "100%" }}
                        >
                            <div>
                                <Text type="secondary">
                                    Use an identifier when possible.
                                    <br />
                                    Name-based searches may return multiple
                                    matches.
                                </Text>
                            </div>
                            <Divider />
                            {program.programTrackedEntityAttributes
                                .map(
                                    ({
                                        trackedEntityAttribute: { id },
                                        ...rest
                                    }) => ({
                                        ...rest,
                                        ...trackedEntityAttributes.get(id)!,
                                    }),
                                )
                                .flatMap(
                                    ({
                                        searchable,
                                        displayFormName,
                                        name,
                                        id,
                                    }) => {
                                        if (!searchable) {
                                            return null;
                                        }
                                        return (
                                            <div key={id}>
                                                <Text strong>
                                                    {displayFormName || name}
                                                </Text>
                                                <Input
                                                    placeholder={
                                                        displayFormName || name
                                                    }
                                                    value={
                                                        search[id]?.[0] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setSearch((prev) => ({
                                                            ...prev,
                                                            [id]: [
                                                                e.target.value,
                                                            ],
                                                        }))
                                                    }
                                                    style={{ marginTop: 8 }}
                                                />
                                            </div>
                                        );
                                    },
                                )}
                            <Space style={{ width: "100%", marginTop: 16 }}>
                                <Button
                                    type="primary"
                                    icon={<SearchOutlined />}
                                    onClick={handleSearch}
                                >
                                    Search
                                </Button>
                                <Button onClick={handleClear}>Clear</Button>
                            </Space>
                        </Space>
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
                                    <TrackerRegistration />
                                    <Text>
                                        {`${trackedEntities.length} results matching: '${Object.values(
                                            search,
                                        )
                                            .flat()
                                            .join(", ")}'`}
                                    </Text>
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
