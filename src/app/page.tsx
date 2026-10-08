import { NavCards } from '@/components/layout/NavCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { NAV_AREAS } from '@/config/navigation';
import { APP_COPY } from '@/locales';

export default function Home() {
    return (
        <>
            <PageHeader title={APP_COPY.home.welcome} subtitle={APP_COPY.home.subtitle} />
            <NavCards groups={[{ items: NAV_AREAS.filter((area) => !area.pinnedBottom) }]} />
        </>
    );
}
