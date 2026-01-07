import React, { Component, ErrorInfo, ReactNode } from "react";
import { Result, Button, Typography, Space, Collapse } from "antd";
import { WarningOutlined, ReloadOutlined, BugOutlined } from "@ant-design/icons";

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

/**
 * Sync Error Boundary Component
 *
 * Catches errors during sync operations and provides recovery options.
 * This boundary specifically handles sync-related errors and provides
 * user-friendly error messages and recovery actions.
 */

interface SyncErrorBoundaryProps {
    children: ReactNode;
    onReset?: () => void;
}

interface SyncErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorCount: number;
}

export class SyncErrorBoundary extends Component<
    SyncErrorBoundaryProps,
    SyncErrorBoundaryState
> {
    constructor(props: SyncErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<SyncErrorBoundaryState> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("🚨 Sync Error Boundary caught error:", error, errorInfo);

        this.setState((prevState) => ({
            error,
            errorInfo,
            errorCount: prevState.errorCount + 1,
        }));

        // Log error for debugging
        this.logError(error, errorInfo);
    }

    /**
     * Log error details for debugging
     */
    private logError(error: Error, errorInfo: ErrorInfo): void {
        console.group("🐛 Sync Error Details");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        console.error("Component Stack:", errorInfo.componentStack);
        console.groupEnd();
    }

    /**
     * Reset error boundary state
     */
    private handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });

        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    /**
     * Reload the page to recover from error
     */
    private handleReload = (): void => {
        window.location.reload();
    };

    /**
     * Check if error is sync-related
     */
    private isSyncError(error: Error): boolean {
        const syncKeywords = [
            "sync",
            "indexeddb",
            "dexie",
            "database",
            "network",
            "fetch",
            "api",
        ];

        const errorMessage = error.message.toLowerCase();
        const errorStack = error.stack?.toLowerCase() || "";

        return syncKeywords.some(
            (keyword) =>
                errorMessage.includes(keyword) || errorStack.includes(keyword)
        );
    }

    /**
     * Get user-friendly error message
     */
    private getUserFriendlyMessage(error: Error): string {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes("network")) {
            return "Network connection issue. Please check your internet connection.";
        }

        if (errorMessage.includes("indexeddb") || errorMessage.includes("dexie")) {
            return "Local database issue. Your data is safe, but there may be a storage problem.";
        }

        if (errorMessage.includes("fetch") || errorMessage.includes("api")) {
            return "Unable to connect to the server. Please try again later.";
        }

        if (this.isSyncError(error)) {
            return "Sync operation failed. Your data is saved locally and will sync when possible.";
        }

        return "An unexpected error occurred. Please try reloading the page.";
    }

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            const isSyncError = this.isSyncError(this.state.error);
            const userMessage = this.getUserFriendlyMessage(this.state.error);

            // If too many errors, suggest reload
            if (this.state.errorCount >= 3) {
                return (
                    <Result
                        status="error"
                        icon={<BugOutlined />}
                        title="Multiple Errors Detected"
                        subTitle="The application has encountered multiple errors. Please reload the page."
                        extra={[
                            <Button
                                key="reload"
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={this.handleReload}
                            >
                                Reload Page
                            </Button>,
                        ]}
                    />
                );
            }

            return (
                <Result
                    status={isSyncError ? "warning" : "error"}
                    icon={<WarningOutlined />}
                    title={isSyncError ? "Sync Error" : "Application Error"}
                    subTitle={userMessage}
                    extra={[
                        <Space key="actions" direction="vertical" style={{ width: "100%" }}>
                            <Space>
                                <Button
                                    type="primary"
                                    icon={<ReloadOutlined />}
                                    onClick={this.handleReset}
                                >
                                    Try Again
                                </Button>
                                <Button onClick={this.handleReload}>Reload Page</Button>
                            </Space>

                            {process.env.NODE_ENV === "development" && (
                                <Collapse
                                    ghost
                                    style={{ marginTop: 16, textAlign: "left" }}
                                >
                                    <Panel header="Error Details (Development)" key="1">
                                        <Space direction="vertical" style={{ width: "100%" }}>
                                            <div>
                                                <Text strong>Error Message:</Text>
                                                <Paragraph
                                                    code
                                                    copyable
                                                    style={{
                                                        marginTop: 8,
                                                        maxWidth: 600,
                                                        wordBreak: "break-word",
                                                    }}
                                                >
                                                    {this.state.error.message}
                                                </Paragraph>
                                            </div>

                                            {this.state.error.stack && (
                                                <div>
                                                    <Text strong>Stack Trace:</Text>
                                                    <Paragraph
                                                        code
                                                        style={{
                                                            marginTop: 8,
                                                            maxHeight: 200,
                                                            overflow: "auto",
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {this.state.error.stack}
                                                    </Paragraph>
                                                </div>
                                            )}

                                            {this.state.errorInfo?.componentStack && (
                                                <div>
                                                    <Text strong>Component Stack:</Text>
                                                    <Paragraph
                                                        code
                                                        style={{
                                                            marginTop: 8,
                                                            maxHeight: 200,
                                                            overflow: "auto",
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {this.state.errorInfo.componentStack}
                                                    </Paragraph>
                                                </div>
                                            )}
                                        </Space>
                                    </Panel>
                                </Collapse>
                            )}
                        </Space>,
                    ]}
                />
            );
        }

        return this.props.children;
    }
}
