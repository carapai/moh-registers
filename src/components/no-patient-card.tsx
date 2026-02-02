import { Button, Card, Space, Typography } from "antd";
import React, { useState } from "react";
import { TrackerRegistration } from "./tracker-registration";
import { TrackerContext } from "../machines/tracker";
import { Spinner } from "./Spinner";
import { PlusOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const NoPatientsCard: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const isLoading = TrackerContext.useSelector((state) =>
        state.matches("loading"),
    );

    if (isLoading) {
        return <Spinner height="100%" />;
    }
    return (
        <>
            <Card
                variant="borderless"
                style={{
                    textAlign: "center",
                    padding: "60px 40px",
                }}
            >
                <Space
                    orientation="vertical"
                    size="large"
                    style={{ width: "100%" }}
                >
                    <Title level={3} style={{ color: "#2c3e50", margin: 0 }}>
                        No clients found.
                    </Title>

                    <Text
                        style={{
                            fontSize: "16px",
                            color: "#5a6c7d",
                            lineHeight: "1.6",
                            display: "block",
                            maxWidth: "500px",
                            margin: "0 auto",
                        }}
                    >
                        Try refining your search criteria or checking
                        registration details before registering a new client.
                    </Text>
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            background:
                                "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                            borderColor: "#7c3aed",
                            height: "48px",
                            paddingLeft: 32,
                            paddingRight: 32,
                            fontSize: "16px",
                        }}
                    >
                        Register New Client
                    </Button>
                </Space>
            </Card>
            <TrackerRegistration
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                modalTitle="Client Registration"
                submitButtonText="Register Client"
            />
        </>
    );
};

export default NoPatientsCard;
