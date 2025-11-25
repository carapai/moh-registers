import { Outlet } from "@tanstack/react-router";
import { Splitter } from "antd";
import React, { useEffect } from "react";
import OrgUnitTreeSelect from "../components/tree-select";
import { RootRoute } from "../routes/__root";
import { ClientsRoute } from "../routes/clients";
import TrackedEntities from "./tracked-entities";
export default function Clients() {
    const navigate = ClientsRoute.useNavigate();
    const { orgUnit } = ClientsRoute.useSearch();
    const { organisationUnits } = RootRoute.useLoaderData();
    useEffect(() => {
        if (organisationUnits.length === 1 && organisationUnits.at(0)?.leaf) {
            navigate({
                search: { orgUnit: organisationUnits.at(0)?.id },
            });
        }
    }, [organisationUnits]);
    return (
        <Splitter
            style={{
                flex: 1,
            }}
        >
            <Splitter.Panel
                collapsible={{
                    start: true,
                    end: true,
                    showCollapsibleIcon: true,
                }}
                defaultSize={"40%"}
                style={{ paddingRight: 10 }}
            >
                <OrgUnitTreeSelect
                    onChange={(value) => {
                        navigate({ search: { orgUnit: value } });
                    }}
                    value={orgUnit}
                />
								<TrackedEntities />
            </Splitter.Panel>
            <Splitter.Panel style={{ paddingLeft: 10 }}>
                <Outlet />
            </Splitter.Panel>
        </Splitter>
    );
}
