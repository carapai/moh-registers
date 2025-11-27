import React from "react";
import { DataElement, ProgramStage } from "../schemas";
import {
    Button,
    Card,
    Checkbox,
    Col,
    Collapse,
    DatePicker,
    Descriptions,
    Flex,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Radio,
    Row,
    Select,
    Space,
    Splitter,
    Table,
    Tabs,
    Typography,
} from "antd";
import { isDate } from "lodash";
import dayjs from "dayjs";
import { RootRoute } from "../routes/__root";

export const DataElementField: React.FC<{
    dataElement: DataElement;
    hidden: boolean;
    renderOptionsAsRadio: boolean;
    vertical: boolean;
}> = ({ dataElement, hidden, renderOptionsAsRadio, vertical }) => {
    const { allDataElements } = RootRoute.useLoaderData();
    let element: React.ReactNode = <Input />;
    if (hidden) return null;
    if (
        dataElement.optionSetValue &&
        dataElement.optionSet &&
        !renderOptionsAsRadio
    ) {
        element = (
            <Select
                options={dataElement.optionSet.options.map((o) => ({
                    label: o.name,
                    value: o.code,
                }))}
                allowClear
                mode={
                    dataElement.valueType === "MULTI_TEXT"
                        ? "multiple"
                        : undefined
                }
                showSearch={{
                    filterOption: (input, option) =>
                        option
                            ? option.label
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                            : false,
                }}
            />
        );
    } else if (
        dataElement.optionSetValue &&
        dataElement.optionSet &&
        renderOptionsAsRadio
    ) {
        element = (
            <Radio.Group vertical={vertical}>
                {dataElement.optionSet.options.map((o) => (
                    <Radio key={o.code} value={o.code}>
                        {o.name}
                    </Radio>
                ))}
            </Radio.Group>
        );
    } else if (dataElement.valueType === "BOOLEAN") {
        element = (
            <Checkbox>{dataElement.formName ?? dataElement.name}</Checkbox>
        );
    } else if (
        dataElement.valueType === "DATE" ||
        dataElement.valueType === "DATETIME" ||
        dataElement.valueType === "TIME" ||
        dataElement.valueType === "AGE"
    ) {
        element = (
            <DatePicker
                style={{
                    width: "100%",
                }}
            />
        );
    } else if (dataElement.valueType === "LONG_TEXT") {
        element = <Input.TextArea rows={4} />;
    } else if (
        ["NUMBER", "INTEGER", "INTEGER_POSITIVE"].includes(
            dataElement.valueType ?? "",
        )
    ) {
        element = (
            <InputNumber
                style={{
                    width: "100%",
                }}
            />
        );
    }
    return (
        <Col span={8} key={dataElement.id}>
            <Form.Item
                key={dataElement.id}
                label={
                    dataElement.valueType === "BOOLEAN"
                        ? null
                        : `${dataElement.formName || dataElement.name}`
                }
                name={dataElement.id}
                required={allDataElements.get(dataElement.id)?.compulsory}
                getValueProps={
                    isDate(dataElement?.valueType)
                        ? (value) =>
                              isDate(dataElement?.valueType)
                                  ? {
                                        value: value ? dayjs(value) : null,
                                    }
                                  : {}
                        : undefined
                }
                normalize={(value) =>
                    isDate(dataElement?.valueType) && dayjs.isDayjs(value)
                        ? value.format("YYYY-MM-DD")
                        : value
                }
            >
                {element}
            </Form.Item>
        </Col>
    );
};
