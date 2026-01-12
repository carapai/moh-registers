import { Card, Space, Typography } from "antd";
import React from "react";
import { TrackerRegistration } from "./tracker-registration";
import { TrackerContext } from "../machines/tracker";
import { Spinner } from "./Spinner";

const { Title, Text } = Typography;

const NoPatientsCard: React.FC = () => {
    const isLoading = TrackerContext.useSelector((state) =>
        state.matches("loading"),
    );

    if (isLoading) {
        return <Spinner height="100%"/>;
    }
    return (
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
                    No patients found.
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
                    Try refining your search criteria or checking registration
                    details before registering a new patient.
                </Text>
                <TrackerRegistration />
            </Space>
        </Card>
    );
};

export default NoPatientsCard;
