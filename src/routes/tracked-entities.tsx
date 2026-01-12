import React from "react";
import { createRoute } from "@tanstack/react-router";
import { PatientTable } from "../components/patient-table";
import { ClientSchema, TrackedEntityResponse } from "../schemas";
import { RootRoute } from "./__root";
import { Button, Card, Col, Flex, Form, Input, Row, Statistic } from "antd";
import dayjs from "dayjs";
import MedicalRegistry from "../components/medical-registry";
import { resourceQueryOptions } from "../query-options";
export const TrackedEntitiesRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entities",
    component: MedicalRegistry,
    validateSearch: ClientSchema,
    loader: async ({ context: { queryClient, engine, orgUnit } }) => {
        const params = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "SELECTED",
            orgUnits: orgUnit.id,
            fields: "trackedEntity",
        });
        const params2 = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "SELECTED",
            orgUnits: orgUnit.id,
            fields: "trackedEntity",
            enrollmentEnrolledAfter: dayjs().format("YYYY-MM-DD"),
            enrollmentEnrolledBefore: dayjs().format("YYYY-MM-DD"),
        });
        const params3 = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "SELECTED",
            orgUnit: orgUnit.id,
            fields: "event",
            status: "SCHEDULE",
            scheduledAfter: dayjs().format("YYYY-MM-DD"),
        });

        const {
            pager: { total },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/trackedEntities?${params.toString()}`,
                queryKey: [
                    "trackedEntities",
                    orgUnit.id,
                    Array.from(params.values()).sort().join(","),
                ],
            }),
        );
        const {
            pager: { total: enrollments },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/trackedEntities?${params2.toString()}`,
                queryKey: [
                    "trackedEntities",
                    orgUnit.id,
                    Array.from(params2.values()).sort().join(","),
                ],
            }),
        );
        const {
            pager: { total: appointments },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/events?${params3.toString()}`,
                queryKey: [
                    "events",
                    orgUnit.id,
                    Array.from(params3.values()).sort().join(","),
                ],
            }),
        );
        return { total, enrollments, appointments };
    },
});
