import { Table } from "antd";
import React from "react";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { ClientsRoute } from "../routes/clients";
import { getAttributes } from "../utils/utils";

export default function TrackedEntities() {
    const { program } = RootRoute.useLoaderData();
    const navigate = ClientsRoute.useNavigate();
    const search = ClientsRoute.useSearch();
    const data = TrackerContext.useSelector(
        (state) => state.context.trackedEntities,
    );

		console.log('TrackedEntities data:', data);
    // return (
        
    // );
}
