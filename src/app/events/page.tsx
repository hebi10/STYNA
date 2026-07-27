import EventList from "./_components/EventList";
import { EventProvider } from "@/context/eventProvider";
import styles from "./page.module.css";
import type { Metadata } from "next";
import { routeMetadata } from "@/shared/constants/routeMetadata";

export const metadata: Metadata = routeMetadata.events;

export default function EventsPage() {
  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <EventProvider>
          <EventList />
        </EventProvider>
      </div>
    </main>
  );
}
