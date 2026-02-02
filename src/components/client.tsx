import { ClientRoute, ClientsRoute } from "../routes/clients";
import type { DescriptionsProps } from "antd";
import React, { useState } from "react";
import {
    Form,
    Input,
    Button,
    Card,
    Typography,
    Space,
    message,
    Table,
    Modal,
    DatePicker,
    Select,
    Tag,
    Row,
    Col,
    Descriptions,
    Flex,
    Collapse,
    Splitter,
} from "antd";
import {
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    HomeOutlined,
    CalendarOutlined,
    MedicineBoxOutlined,
    PlusOutlined,
    EyeOutlined,
    CaretRightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function Client() {
    const { clientId } = ClientRoute.useParams();
    const search = ClientRoute.useSearch();

    const [patientForm] = Form.useForm();
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

    const columns = [
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (date) => dayjs(date).format("MMM DD, YYYY"),
        },
        {
            title: "Reason",
            dataIndex: "reason",
            key: "reason",
        },
        {
            title: "Doctor",
            dataIndex: "doctor",
            key: "doctor",
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status) => (
                <Tag color={status === "Completed" ? "green" : "blue"}>
                    {status}
                </Tag>
            ),
        },
        {
            title: "Action",
            key: "action",
            render: (_, record) => (
                <Button
                    icon={<EyeOutlined />}
                    onClick={() => showVisitModal(record)}
                >
                    View
                </Button>
            ),
        },
    ];

    const items: DescriptionsProps["items"] = [
        {
            label: "Product",
            children: "Cloud Database",
        },
        {
            label: "Billing",
            children: "Prepaid",
        },
        {
            label: "Time",
            children: "18:00:00",
        },
        {
            label: "Amount",
            children: "$80.00",
        },
    ];
    return (
        <>
            <Splitter style={{ height: "calc(100vh - 48px)" }}>
                <Splitter.Panel style={{ padding: 10 }}>
                    <Flex vertical gap="16px">
                        <Descriptions bordered column={6} items={items} />
                        <Card
                            title={
                                <Space>
                                    <CalendarOutlined />
                                    <span>Client Visits</span>
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
                                dataSource={visits}
                                pagination={{ pageSize: 10 }}
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
                                    children: <p></p>,
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                        />
                    </Flex>
                </Splitter.Panel>
            </Splitter>

            {/* Visits List Section */}

            {/* Visit Modal */}
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
                width={700}
            >
                <Form
                    form={visitForm}
                    layout="vertical"
                    onFinish={onVisitSubmit}
                    disabled={!!selectedVisit}
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
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

                        <Col xs={24} sm={12}>
                            <Form.Item
                                label="Status"
                                name="status"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select status!",
                                    },
                                ]}
                            >
                                <Select placeholder="Select status">
                                    <Option value="Scheduled">Scheduled</Option>
                                    <Option value="Completed">Completed</Option>
                                    <Option value="Cancelled">Cancelled</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col xs={24} sm={12}>
                            <Form.Item
                                label="Reason for Visit"
                                name="reason"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please enter reason!",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter reason for visit" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} sm={12}>
                            <Form.Item
                                label="Doctor"
                                name="doctor"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select doctor!",
                                    },
                                ]}
                            >
                                <Select placeholder="Select doctor">
                                    <Option value="Dr. Smith">Dr. Smith</Option>
                                    <Option value="Dr. Johnson">
                                        Dr. Johnson
                                    </Option>
                                    <Option value="Dr. Williams">
                                        Dr. Williams
                                    </Option>
                                    <Option value="Dr. Brown">Dr. Brown</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item label="Diagnosis" name="diagnosis">
                                <TextArea
                                    rows={3}
                                    placeholder="Enter diagnosis"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item label="Treatment" name="treatment">
                                <TextArea
                                    rows={3}
                                    placeholder="Enter treatment plan"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24}>
                            <Form.Item label="Notes" name="notes">
                                <TextArea
                                    rows={3}
                                    placeholder="Additional notes"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </>
    );
}
