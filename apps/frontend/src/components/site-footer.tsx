export default function SiteFooter() {
  return (
    <>
      <footer className='border-t-2 py-6 md:px-8 md:py-0'>
        <div className='container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row'>
          <section className={'flex items-center gap-3'}></section>
          <p className='text-balance text-center text-sm leading-loose text-muted-foreground md:text-left'>
            ©️ 2025 Team{' '}
            <a
              href={'/'}
              target='_blank'
              rel='noreferrer'
              className='font-medium underline underline-offset-4'
            >
              Nirbhaya Astra
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
