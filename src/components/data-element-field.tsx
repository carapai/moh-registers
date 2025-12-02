import {
    Checkbox,
    Col,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Radio,
    Select,
} from "antd";
import React from "react";
import {
    DataElement,
    Message,
    OptionSet,
    TrackedEntityAttribute,
} from "../schemas";
import { createGetValueProps, createNormalize } from "../utils/utils";

export const DataElementField: React.FC<{
    dataElement: DataElement | TrackedEntityAttribute;
    hidden: boolean;
    renderOptionsAsRadio: boolean;
    vertical: boolean;
    finalOptions?: OptionSet["options"];
    errors: Array<Message>;
    messages: Array<Message>;
    warnings: Array<Message>;
    required: boolean;
}> = ({
    dataElement,
    hidden,
    renderOptionsAsRadio,
    vertical,
    finalOptions,
    errors,
    messages,
    warnings,
    required,
}) => {
    if (hidden) return null;
    let element: React.ReactNode = <Input />;

    if (
        dataElement.optionSetValue &&
        dataElement.optionSet &&
        !renderOptionsAsRadio
    ) {
        element = (
            <Select
                options={finalOptions?.flatMap((o) => ({
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
                {finalOptions?.map((o) => (
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
                required={required}
                getValueProps={createGetValueProps(dataElement.valueType)}
                normalize={createNormalize(dataElement.valueType)}
                extra={warnings.map((w) => w.content)}
            >
                {element}
            </Form.Item>
        </Col>
    );
};
