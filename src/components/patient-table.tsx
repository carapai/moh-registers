import {
    CloseOutlined,
    MoreOutlined,
    FilterOutlined,
    PlusOutlined,
    SearchOutlined,
    SettingOutlined,
} from "@ant-design/icons";
import type { InputRef, MenuProps, TableColumnType } from "antd";
import {
    Avatar,
    Button,
    Checkbox,
    DatePicker,
    Dropdown,
    Flex,
    Input,
    Popover,
    Space,
    Table,
    Tag,
    Typography,
} from "antd";
import type { TableProps } from "antd/es/table";
import { FilterDropdownProps } from "antd/es/table/interface";
import dayjs from "dayjs";
import React, { useMemo, useRef, useState } from "react";
import { TrackerContext } from "../machines/tracker";
import { TrackedEntityAttribute } from "../schemas";
import { flattenTrackedEntityResponse } from "../utils/utils";
import { PatientLastVisit } from "./patient-last-visit";

const { Text } = Typography;

const getInitialsColor = (values: Record<string, any>) => {
    const colors = [
        "#f56a00",
        "#7265e6",
        "#ffbf00",
        "#00a2ae",
        "#87d068",
        "#1890ff",
    ];

    if (values["bqliZKdUGMX"] === "Male") {
        return colors.at(-1);
    }
    if (values["bqliZKdUGMX"] === "Female") {
        return colors[0];
    }

    return colors[0];
};

export const PatientTable: React.FC = () => {
    const searchInput = useRef<InputRef>(null);
    const [searchText, setSearchText] = useState("");

    const activeFilters = TrackerContext.useSelector(
        (state) => state.context.search.filters,
    );
    const trackedEntities = TrackerContext.useSelector(
        (state) => state.context.trackedEntities,
    );
    const trackerActor = TrackerContext.useActorRef();
    const attributes = TrackerContext.useSelector(
        (state) => state.context.programTrackedEntityAttributes,
    );
    const total = TrackerContext.useSelector(
        (state) => state.context.search.pagination.total,
    );
    const pageSize = TrackerContext.useSelector(
        (state) => state.context.search.pagination.pageSize,
    );
    const current = TrackerContext.useSelector(
        (state) => state.context.search.pagination.current,
    );

    const isLoading = TrackerContext.useSelector((state) =>
        state.matches("loading"),
    );

    const handleSearch = (
        selectedKeys: string[],
        confirm: () => void,
        dataIndex: keyof ReturnType<
            typeof flattenTrackedEntityResponse
        >[number]["attributes"],
    ) => {
        confirm();
        // Send filter update to state machine
        trackerActor.send({
            type: "FETCH_NEXT_PAGE",
            search: {
                pagination: {
                    current,
                    pageSize,
                },
                filters: {
                    ...activeFilters,
                    [dataIndex]: selectedKeys,
                },
            },
        });
    };

    const handleReset = (clearFilters?: () => void, dataIndex?: string) => {
        clearFilters?.();
        // Remove specific filter from state machine
        if (dataIndex) {
            const newFilters = { ...activeFilters };
            delete newFilters[dataIndex];
            trackerActor.send({
                type: "FETCH_NEXT_PAGE",
                search: {
                    pagination: {
                        current,
                        pageSize,
                    },
                    filters: newFilters,
                },
            });
        }
    };

    const getFilterDisplayName = (key: string) => {
        const element = attributes.find(
            (de) => de.trackedEntityAttribute.id === key,
        );
        return (
            element?.trackedEntityAttribute.displayFormName ||
            element?.trackedEntityAttribute.name ||
            key
        );
    };

    const removeFilter = (filterKey: string) => {
        const newFilters = { ...activeFilters };
        delete newFilters[filterKey];
        trackerActor.send({
            type: "FETCH_NEXT_PAGE",
            search: {
                pagination: {
                    current,
                    pageSize,
                },
                filters: newFilters,
            },
        });
    };

    const clearAllFilters = () => {
        trackerActor.send({
            type: "FETCH_NEXT_PAGE",
            search: {
                pagination: {
                    current,
                    pageSize,
                },
                filters: {},
            },
        });
    };

    const hasActiveFilters =
        Object.keys(activeFilters).length > 0 &&
        Object.values(activeFilters).some(
            (val) => val !== null && val !== undefined && val.length > 0,
        );

    const actionMenu: MenuProps = {
        items: [
            {
                key: "1",
                label: "View Details",
            },
            {
                key: "2",
                label: "Edit Patient",
            },
            {
                key: "3",
                label: "Schedule Appointment",
            },
            {
                key: "4",
                label: "View History",
            },
        ],
    };
    const getColumnSearchProps = (
        dataIndex: TrackedEntityAttribute,
    ): TableColumnType<
        ReturnType<typeof flattenTrackedEntityResponse>[number]
    > => {
        let filterDropdown: any = undefined;

        if (
            dataIndex.valueType === "DATE" ||
            dataIndex.valueType === "DATETIME" ||
            dataIndex.valueType === "TIME" ||
            dataIndex.valueType === "AGE"
        ) {
            filterDropdown = ({
                setSelectedKeys,
                selectedKeys,
                confirm,
                clearFilters,
                close,
            }: FilterDropdownProps) => (
                <div
                    style={{ padding: 8 }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <DatePicker
                        onChange={(date, dateString) => {
                            setSelectedKeys([dateString].flat());
                        }}
                        value={
                            selectedKeys[0]
                                ? dayjs(String(selectedKeys[0]))
                                : null
                        }
                        style={{ marginBottom: 8, display: "block" }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() =>
                                handleSearch(
                                    selectedKeys as string[],
                                    confirm,
                                    dataIndex.id as keyof ReturnType<
                                        typeof flattenTrackedEntityResponse
                                    >[number]["attributes"],
                                )
                            }
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={() =>
                                handleReset(clearFilters, dataIndex.id)
                            }
                            size="small"
                            style={{ width: 90 }}
                        >
                            Reset
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            onClick={() => {
                                close();
                            }}
                        >
                            Close
                        </Button>
                    </Space>
                </div>
            );
        } else if (dataIndex.optionSetValue === false) {
            filterDropdown = ({
                setSelectedKeys,
                selectedKeys,
                confirm,
                clearFilters,
            }: FilterDropdownProps) => (
                <div
                    style={{ padding: 8 }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <Input
                        ref={searchInput}
                        value={selectedKeys[0]}
                        onChange={(e) =>
                            setSelectedKeys(
                                e.target.value ? [e.target.value] : [],
                            )
                        }
                        onPressEnter={() =>
                            handleSearch(
                                selectedKeys as string[],
                                confirm,
                                dataIndex.id as keyof ReturnType<
                                    typeof flattenTrackedEntityResponse
                                >[number]["attributes"],
                            )
                        }
                        style={{ marginBottom: 8, display: "block" }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() =>
                                handleSearch(
                                    selectedKeys as string[],
                                    confirm,
                                    dataIndex.id as keyof ReturnType<
                                        typeof flattenTrackedEntityResponse
                                    >[number]["attributes"],
                                )
                            }
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={() =>
                                handleReset(clearFilters, dataIndex.id)
                            }
                            size="small"
                            style={{ width: 90 }}
                        >
                            Reset
                        </Button>
                    </Space>
                </div>
            );
        }
        if (dataIndex.optionSetValue && dataIndex.optionSet?.options) {
            return {
                filters: dataIndex.optionSet.options.map((opt) => ({
                    text: opt.name,
                    value: opt.code,
                })),
                filteredValue: activeFilters[dataIndex.id] || null,
                onFilterDropdownOpenChange: (visible) => {
                    if (visible) {
                        setTimeout(() => searchInput.current?.select(), 100);
                    }
                },
            };
        }

        return {
            filterDropdown,
            filteredValue: activeFilters[dataIndex.id] || null,
            onFilterDropdownOpenChange: (visible) => {
                if (visible) {
                    setTimeout(() => searchInput.current?.select(), 100);
                }
            },
        };
    };

    const handleTableChange: TableProps<
        ReturnType<typeof flattenTrackedEntityResponse>[number]
    >["onChange"] = (pagination, filters, sorter) => {
        trackerActor.send({
            type: "FETCH_NEXT_PAGE",
            search: { pagination, filters },
        });
    };

    const columns: TableProps<
        ReturnType<typeof flattenTrackedEntityResponse>[number]
    >["columns"] = useMemo(() => {
        return [
            {
                displayInList: true,
                trackedEntityAttribute: {
                    displayFormName: "Patient Name",
                    name: "Patient Name",
                    id: "patientName",
                    valueType: "TEXT",
                    optionSetValue: false,
                    generated: false,
                    unique: false,
                    pattern: "",
                    confidential: false,
                },
            },

            {
                displayInList: true,
                trackedEntityAttribute: {
                    displayFormName: "Registration Date",
                    name: "Registration Date",
                    id: "enrolledAt",
                    valueType: "DATE",
                    optionSetValue: false,
                    generated: false,
                    unique: false,
                    pattern: "",
                    confidential: false,
                },
            },
            ...attributes,
            {
                displayInList: true,
                trackedEntityAttribute: {
                    displayFormName: "Last Visit",
                    name: "Last Visit",
                    id: "lastVisit",
                    valueType: "DATE",
                    optionSetValue: false,
                    generated: false,
                    unique: false,
                    pattern: "",
                    confidential: false,
                },
            },
            {
                displayInList: true,
                trackedEntityAttribute: {
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
            },
        ].flatMap(({ trackedEntityAttribute, ...rest }) => {
            if (!rest.displayInList) {
                return [];
            }

            if (trackedEntityAttribute.id === "patientName") {
                return {
                    title: "Patient Name",
                    fixed: "left",
                    width: 250,
                    key: "orgUnit",
                    dataIndex: "orgUnit",
                    render: (_, record) => {
                        return (
                            <Space>
                                <Avatar
                                    style={{
                                        backgroundColor: getInitialsColor(
                                            record.attributes,
                                        ),
                                    }}
                                >
                                    {[
                                        record.attributes["KSq9EyZ8ZFi"] ?? "",
                                        record.attributes["TWPNbc9O2nK"] ?? "",
                                    ]
                                        .map((n) => n[0])
                                        .join("")}
                                </Avatar>
                                <div>
                                    <div
                                        style={{
                                            fontWeight: 500,
                                        }}
                                    >
                                        {[
                                            record.attributes["KSq9EyZ8ZFi"] ??
                                                "",
                                            record.attributes["TWPNbc9O2nK"] ??
                                                "",
                                        ].join(" ")}
                                    </div>
                                    <Text
                                        type="secondary"
                                        style={{
                                            fontSize: "12px",
                                        }}
                                    >
                                        {record.attributes["bqliZKdUGMX"]}
                                    </Text>
                                </div>
                            </Space>
                        );
                    },
                };
            }

            if (trackedEntityAttribute.id === "lastVisit") {
                return {
                    title:
                        trackedEntityAttribute.displayFormName ||
                        trackedEntityAttribute.name,
                    key: trackedEntityAttribute.id,
                    render: (_, record) => (
                        <PatientLastVisit
                            trackedEntity={record.trackedEntity}
                        />
                    ),
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
                                    fontSize: 28,
                                }}
                            />
                        </Dropdown>
                    ),
                };
            }
            if (trackedEntityAttribute.id === "enrolledAt") {
                return {
                    title:
                        trackedEntityAttribute.displayFormName ||
                        trackedEntityAttribute.name,
                    dataIndex: ["enrollment", trackedEntityAttribute.id],
                    key: trackedEntityAttribute.id,
                    ...getColumnSearchProps(trackedEntityAttribute),

                    render: (dateString: string) => (
                        <Tag color="blue" style={{ fontSize: 16 }}>
                            {dayjs(dateString).format("DD/MM/YYYY")}
                        </Tag>
                    ),
                };
            }
            return {
                title:
                    trackedEntityAttribute.displayFormName ||
                    trackedEntityAttribute.name,
                dataIndex: ["attributes", trackedEntityAttribute.id],
                key: trackedEntityAttribute.id,
                ...getColumnSearchProps(trackedEntityAttribute),
            };
        });
    }, [attributes, activeFilters]);

    const columnSelectorContent = (
        <Space vertical>
            {attributes.map((col) => (
                <Checkbox
                    key={col.id}
                    checked={col.displayInList}
                    onChange={() =>
                        trackerActor.send({
                            type: "TOGGLE_ATTRIBUTE_COLUMN",
                            attributeId: col.id,
                        })
                    }
                >
                    {col.trackedEntityAttribute.displayFormName ||
                        col.trackedEntityAttribute.name}
                </Checkbox>
            ))}
        </Space>
    );

    return (
        <Flex vertical gap="16px">
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    padding: "24px",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                    }}
                >
                    <Flex align="center" gap="8px">
                        <h1
                            style={{
                                margin: 0,
                                fontSize: "24px",
                                fontWeight: 600,
                            }}
                        >
                            My Patients
                        </h1>

                        {hasActiveFilters && (
                            <Flex
                                gap={8}
                                align="center"
                                wrap="wrap"
                                style={{
                                    padding: "12px 16px",
                                    background: "#f5f5f5",
                                    borderRadius: "8px",
                                }}
                            >
                                <Typography.Text
                                    strong
                                    style={{ marginRight: 8 }}
                                >
                                    Active Filters:
                                </Typography.Text>
                                {Object.entries(activeFilters).map(
                                    ([key, values]) => {
                                        if (!values || values.length === 0)
                                            return null;
                                        return (
                                            <Tag
                                                key={key}
                                                closable
                                                onClose={() =>
                                                    removeFilter(key)
                                                }
                                                closeIcon={<CloseOutlined />}
                                                color="blue"
                                                style={{
                                                    margin: 0,
                                                    fontSize: 13,
                                                }}
                                            >
                                                <strong>
                                                    {getFilterDisplayName(key)}:
                                                </strong>{" "}
                                                {Array.isArray(values)
                                                    ? values.join(", ")
                                                    : String(values)}
                                            </Tag>
                                        );
                                    },
                                )}
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={clearAllFilters}
                                    style={{ padding: 0, height: "auto" }}
                                >
                                    Clear All
                                </Button>
                            </Flex>
                        )}
                    </Flex>
                    <Space>
                        <Input
                            placeholder="Search"
                            prefix={<SearchOutlined />}
                            style={{ width: 400 }}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        <Button icon={<FilterOutlined />} />

                        <Popover
                            content={columnSelectorContent}
                            title="Select Columns"
                            trigger="click"
                            placement="bottomRight"
                        >
                            <Button icon={<SettingOutlined />}>
                                {/* Columns ({visibleCount}/{columns.length}) */}
                            </Button>
                        </Popover>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            style={{
                                backgroundColor: "#7c3aed",
                                borderColor: "#7c3aed",
                            }}
                        >
                            Add Patient
                        </Button>
                    </Space>
                </div>

                <Table
                    scroll={{ x: "max-content" }}
                    dataSource={trackedEntities}
                    columns={columns}
                    rowKey="trackedEntity"
                    onRow={(record) => {
                        return {
                            onClick: () => {
                                trackerActor.send({
                                    type: "SET_TRACKED_ENTITY_ID",
                                    trackedEntityId: record.trackedEntity,
                                });
                            },
                            style: { cursor: "pointer" },
                        };
                    }}
                    loading={isLoading}
                    onChange={handleTableChange}
                    pagination={{
                        pageSize,
                        total,
                        current,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} patients`,
                    }}
                />
            </div>
        </Flex>
    );
};
