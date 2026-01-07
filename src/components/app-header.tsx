import React, { useState } from "react";
import { Layout, Space, Typography, Divider, Button, Badge, Tooltip } from "antd";
import { DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { SyncStatus } from "./sync-status";
import { DraftRecovery } from "./draft-recovery";

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
    title?: string;
}

/**
 * Application Header Component
 *
 * Displays application title and sync status indicator
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
    title = "MOH Registers",
}) => {
    const [draftModalVisible, setDraftModalVisible] = useState(false);

    return (
        <>
            <Header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    background: "#fff",
                    borderBottom: "1px solid #f0f0f0",
                    height: 48,
                }}
            >
                <Space size="middle">
                    <DatabaseOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                    <Title
                        level={4}
                        style={{ margin: 0, fontWeight: 600, color: "#262626" }}
                    >
                        {title}
                    </Title>
                </Space>

                <Space size="large" separator={<Divider orientation="vertical" />}>
                    <Tooltip title="Recover saved drafts">
                        <Button
                            icon={<FileTextOutlined />}
                            onClick={() => setDraftModalVisible(true)}
                        >
                            Drafts
                        </Button>
                    </Tooltip>
                    <SyncStatus />
                </Space>
            </Header>

            <DraftRecovery
                visible={draftModalVisible}
                onClose={() => setDraftModalVisible(false)}
                onRecover={(draft, type) => {
                    console.log("📝 Draft recovered:", { draft, type });
                    // TODO: Implement draft recovery logic
                    // This should navigate to the appropriate form and populate it with draft data
                }}
            />
        </>
    );
};
