import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Button, Modal, Progress, Space, Typography } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useState } from "react";
import { MetadataSync } from "../db/metadata-sync";
import { useMetadataSync } from "../hooks/useMetadataSync";

dayjs.extend(relativeTime);

const { Text } = Typography;

interface MetadataSyncProps {
    metadataSync: MetadataSync;
}

export default function MetadataSyncComponent({ metadataSync }: MetadataSyncProps) {
    const { state, sync, checkForUpdates, isSyncing, isChecking, hasError, lastSync } = useMetadataSync(metadataSync);
    const [showProgressModal, setShowProgressModal] = useState(false);

    const handleSync = async () => {
        try {
            setShowProgressModal(true);
            await sync();
        } catch (error) {
            console.error("Metadata sync failed:", error);
        } finally {
            setTimeout(() => {
                setShowProgressModal(false);
            }, 2000);
        }
    };

    const handleCheckUpdates = async () => {
        try {
            const updateInfo = await checkForUpdates();
            if (updateInfo.hasUpdates) {
                Modal.confirm({
                    title: "Metadata Updates Available",
                    content: `Changes detected in: ${updateInfo.changedTypes.join(", ")}. Would you like to sync now?`,
                    onOk: handleSync,
                    okText: "Sync Now",
                    cancelText: "Later",
                });
            } else {
                Modal.success({
                    title: "Metadata Up to Date",
                    content: `Last synced: ${dayjs(lastSync).fromNow()}`,
                });
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
            Modal.error({
                title: "Check Failed",
                content: "Failed to check for metadata updates. Please try again.",
            });
        }
    };

    const getStatusIcon = () => {
        if (hasError) {
            return <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />;
        }
        if (isSyncing || isChecking) {
            return <ReloadOutlined spin style={{ color: "#1890ff" }} />;
        }
        return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
    };

    const getStatusText = () => {
        if (hasError) {
            return "Sync Error";
        }
        if (isSyncing) {
            return "Syncing...";
        }
        if (isChecking) {
            return "Checking...";
        }
        if (lastSync) {
            return `Synced ${dayjs(lastSync).fromNow()}`;
        }
        return "Not synced";
    };

    return (
        <>
            <Space>
                <Button
                    type="text"
                    icon={getStatusIcon()}
                    onClick={handleCheckUpdates}
                    loading={isChecking}
                    disabled={isSyncing}
                    size="small"
                >
                    <Space size={4}>
                        <ClockCircleOutlined />
                        <Text style={{ fontSize: 12 }}>{getStatusText()}</Text>
                    </Space>
                </Button>
                <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleSync}
                    loading={isSyncing}
                    size="small"
                >
                    Sync Metadata
                </Button>
            </Space>

            <Modal
                title="Syncing Metadata"
                open={showProgressModal}
                footer={null}
                closable={false}
                centered
            >
                <Space direction="vertical" style={{ width: "100%" }} size="large">
                    <Progress
                        percent={state.progress?.percentage ?? 0}
                        status={hasError ? "exception" : isSyncing ? "active" : "success"}
                    />
                    <Text>
                        {state.progress?.current ?? "Preparing..."}
                        {state.progress && ` (${state.progress.completed}/${state.progress.total})`}
                    </Text>
                    {hasError && (
                        <Text type="danger">
                            Sync failed: {state.error}
                        </Text>
                    )}
                    {state.status === "success" && (
                        <Text type="success">
                            ✅ Metadata sync completed successfully!
                        </Text>
                    )}
                </Space>
            </Modal>
        </>
    );
}
