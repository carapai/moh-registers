import {
    CalendarOutlined,
    CaretRightOutlined,
    EyeOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import type { DescriptionsProps, TableProps } from "antd";
import {
    Button,
    Card,
    Collapse,
    Descriptions,
    Flex,
    Form,
    Modal,
    Space,
    Splitter,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import React, { useMemo } from "react";
import EventModal from "../components/event-modal";
import { db, FlattenedEvent } from "../db";
import { populateRelationshipsForEntity } from "../db/operations";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "./__root";
export const TrackedEntityRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entity/$trackedEntity",
    component: TrackedEntity,
});

const { Text } = Typography;

function TrackedEntity() {
    const { trackedEntityAttributes } = RootRoute.useLoaderData();
    const trackerActor = TrackerContext.useActorRef();

    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    const enrollment = trackedEntity.enrollment;

    const attributes = Array.from(trackedEntityAttributes.values());

    const keys: Map<string, string> = new Map(
        attributes?.map((attr) => [
            attr.id,
            attr.displayFormName || attr.name || "",
        ]),
    );

    const relationships = useLiveQuery(async () => {
        if (!trackedEntity.trackedEntity) return [];

        try {
            return await populateRelationshipsForEntity(
                trackedEntity.trackedEntity,
            );
        } catch (error) {
            console.error("Failed to load relationships:", error);
            return [];
        }
    }, [trackedEntity.trackedEntity]);

    const [visitForm] = Form.useForm();
    const events =
        useLiveQuery(async () => {
            if (!trackedEntity.trackedEntity) return [];
            return await db.events
                .where("trackedEntity")
                .equals(trackedEntity.trackedEntity)
                .and((e) => e.programStage === "K2nxbE9ubSs")
                .toArray();
        }, [trackedEntity.trackedEntity]) || [];

    const columns: TableProps<FlattenedEvent>["columns"] = useMemo(
        () => [
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
                render: (text) => {
                    if (Array.isArray(text)) {
                        return (
                            <Flex gap="small" align="center" wrap>
                                {text.map((tag) => {
                                    return (
                                        <Tag key={tag} color="blue">
                                            {tag.toUpperCase()}
                                        </Tag>
                                    );
                                })}
                            </Flex>
                        );
                    }

                    if (!text || typeof text !== "string") return null;

                    return (
                        <Flex gap="small" align="center" wrap>
                            {text.split(",").map((tag) => {
                                return (
                                    <Tag key={tag} color="blue">
                                        {tag.toUpperCase()}
                                    </Tag>
                                );
                            })}
                        </Flex>
                    );
                },
            },
            {
                title: "Action",
                key: "action",
                width: 100,
                render: (_, record) => (
                    <Flex gap="small" align="center">
                        <EventModal
                            currentEvent={record}
                            trackedEntity={trackedEntity}
                            icon={<EyeOutlined />}
                            visitForm={visitForm}
														label="Edit"
                        />
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
                    </Flex>
                ),
            },
        ],
        [],
    );
    const items: DescriptionsProps["items"] = Object.entries(
        trackedEntity.attributes || {},
    ).map(([key, value]) => ({
        key: key,
        label: keys.get(key) || key,
        children: <Text>{String(value)}</Text>,
    }));

    return (
        <>
            <Splitter style={{ height: "calc(100vh - 48px)" }}>
                <Splitter.Panel style={{ padding: 10 }}>
                    <Flex vertical gap="16px">
                        <Flex>
                            <Button
                                onClick={() => {
                                    visitForm.resetFields();
                                    // trackerActor.send({
                                    //     type: "RESET_MAIN_EVENT",
                                    // });
                                    // trackerActor.send({
                                    //     type: "RESET_TRACKED_ENTITY",
                                    // });
                                    trackerActor.send({ type: "GO_BACK" });
                                }}
                            >
                                Back
                            </Button>
                        </Flex>
                        <Card
                            title={
                                <Space>
                                    <CalendarOutlined />
                                    <span>Client Visits</span>
                                    {!navigator.onLine && (
                                        <Tag color="orange">Offline</Tag>
                                    )}
                                </Space>
                            }
                            extra={
                                <EventModal
                                    currentEvent={{} as FlattenedEvent}
                                    trackedEntity={trackedEntity}
                                    icon={<PlusOutlined />}
                                    visitForm={visitForm}
                                    isNewEvent={true}
																		label="Add Visit"
                                />
                            }
                        >
                            <Table
                                columns={columns}
                                dataSource={events}
                                pagination={false}
                                rowKey="event"
                                scroll={{ x: "max-content" }}
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
        </>
    );
}
