import React from "react";
import { Loading3QuartersOutlined } from "@ant-design/icons";
import { Flex, Spin } from "antd";

export default function Spinner() {
    return (
        <Flex justify="center" align="center" style={{ height: "100%" }}>
            <Spin indicator={<Loading3QuartersOutlined spin />} />
        </Flex>
    );
}
