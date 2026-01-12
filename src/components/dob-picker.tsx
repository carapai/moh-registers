import { DatePicker, Flex, FormInstance, InputNumber, Typography } from "antd";
import dayjs from "dayjs";
import React, { useState } from "react";
import { DataElement, TrackedEntityAttribute } from "../schemas";

function dobFromAge(years = 0, months = 0, days = 0) {
    return dayjs()
        .subtract(years, "year")
        .subtract(months, "month")
        .subtract(days, "day");
}

function ageFromDob(dob: dayjs.Dayjs) {
    const now = dayjs();

    const years = now.diff(dob, "year");
    const months = now.subtract(years, "year").diff(dob, "month");
    const days = now
        .subtract(years, "year")
        .subtract(months, "month")
        .diff(dob, "day");

    return { years, months, days };
}

const { Text } = Typography;

export default function DobPicker({
    form,
    dataElement,
    onTriggerProgramRules,
}: {
    form: FormInstance<any>;
    dataElement: DataElement | TrackedEntityAttribute;
    onTriggerProgramRules?: () => void;
}) {
    const [years, setYears] = useState<number | null>(null);
    const [months, setMonths] = useState<number | null>(null);
    const [days, setDays] = useState<number | null>(null);

    const handleAgeChange = (
        newYears: number | null,
        newMonths: number | null,
        newDays: number | null,
    ) => {
        setYears(newYears);
        setMonths(newMonths);
        setDays(newDays);
        const calculatedDob = dobFromAge(
            newYears ?? 0,
            newMonths ?? 0,
            newDays ?? 0,
        );
        // Store as string immediately
        form.setFieldValue(dataElement.id, calculatedDob.format('YYYY-MM-DD'));
        onTriggerProgramRules?.();
    };

    const handleDateChange = (date: dayjs.Dayjs | null) => {
        if (date) {
            const age = ageFromDob(date);
            setYears(age.years);
            setMonths(age.months);
            setDays(age.days);
            // Store as string immediately
            form.setFieldValue(dataElement.id, date.format('YYYY-MM-DD'));
        } else {
            setYears(null);
            setMonths(null);
            setDays(null);
            form.setFieldValue(dataElement.id, null);
        }
        onTriggerProgramRules?.();
    };

    // Get the field value and convert to dayjs if it's a string
    const fieldValue = form.getFieldValue(dataElement.id);
    const dateValue = fieldValue && typeof fieldValue === 'string'
        ? dayjs(fieldValue)
        : fieldValue;

    return (
        <DatePicker
            style={{ width: "100%" }}
            value={dateValue}
            onChange={handleDateChange}
            disabledDate={(d) => d && d.isAfter(dayjs())}
            renderExtraFooter={() => (
                <Flex gap={10} vertical style={{ padding: 8 }}>
                    <Flex gap={5} vertical style={{ width: "100%" }}>
                        <Text>Years</Text>
                        <InputNumber
                            min={0}
                            placeholder="Years"
                            value={years ?? undefined}
                            onChange={(v) => handleAgeChange(v, months, days)}
                            size="small"
                            style={{ width: "100%" }}
                        />
                    </Flex>
                    <Flex gap={5} vertical style={{ width: "100%" }}>
                        <Text>Months</Text>
                        <InputNumber
                            min={0}
                            max={11}
                            placeholder="Months"
                            value={months ?? undefined}
                            onChange={(v) => handleAgeChange(years, v, days)}
                            size="small"
                            style={{ width: "100%" }}
                        />
                    </Flex>
                    <Flex gap={5} vertical style={{ width: "100%" }}>
                        <Text>Days</Text>
                        <InputNumber
                            min={0}
                            max={31}
                            placeholder="Days"
                            value={days ?? undefined}
                            onChange={(v) => handleAgeChange(years, months, v)}
                            size="small"
                            style={{ width: "100%" }}
                        />
                    </Flex>
                </Flex>
            )}
        />
    );
}
