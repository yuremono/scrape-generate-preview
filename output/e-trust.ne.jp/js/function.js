

document.addEventListener('DOMContentLoaded', function () {//開幕動画 htmlクラスで処理変更
        const html = document.documentElement;
        const videoContainer = document.querySelector('.h_video');
        const video = videoContainer?.querySelector('video');
    
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            html.classList.add('reduced');
        }
    
        if (!videoContainer) return;
    
        if (html.classList.contains('reduced')) {
            videoContainer.style.display = 'none';
            video?.pause();
            html.classList.add('videoEnd'); // メインコンテンツ解放
            return;
        }
    
        const isDebug = html.classList.contains('debug');
        const isFirst = !sessionStorage.getItem('visit');
    
        if (isDebug || isFirst) {
            setTimeout(() => {
                videoContainer.classList.add('hide');
                html.classList.add('videoEnd'); // 動画終了後にメイン表示
                video?.addEventListener('transitionend', function handler(e) {
                    if (e.propertyName === 'opacity') {
                        video.pause();
                        videoContainer.style.display = 'none';
                        video.removeEventListener('transitionend', handler);
                    }
                });
            }, 3000);
            if (!isDebug) sessionStorage.setItem('visit', 'true');
        } else {
            videoContainer.style.display = 'none';
            video?.pause();
            html.classList.add('videoEnd'); // 初回でないならすぐメイン表示
        }
    }); 
    
    
    
    document.addEventListener('DOMContentLoaded', function () {//基本処理、要素処理など
        const images = document.querySelectorAll('#contents img');//すべての img タグにlazy
        images.forEach(img => {
            const dataSrc = img.getAttribute('data-src');
            if (dataSrc) {
                img.src = dataSrc; // data-srcがあればsrcに設定
            }
            img.setAttribute('loading', 'lazy'); // loading="lazy" を追加
        });
        try {// 使わないラップ要素を除外、
            $(".dis,.disnone,.dnone").remove();
            $('#main>#col_main,#col_main>section').unwrap();
            $('#side,#col_side1,.dis,.disnone').remove();
            // $(".brnone br,.nobr br,.r_edge div br").remove();
        } catch (error) { console.log(error); }
        try {// バイリンガル
            const switch_btn = '<div class="switch"><input id="cmn-toggle-1" class="cmn-toggle cmn-toggle-round" type="checkbox"><label for="cmn-toggle-1"><span></spsn></label></div>';
            $("#builingual").prepend(switch_btn);
            const windowSize = window.innerWidth;
            if (windowSize > 768) {
            } else {
                $("#builingual").prependTo("#global_header");
            }
            $("span.translate").next().hide();
            $("div.translate").hide();
            $(".switch").on("click", function () {
                if ($("#cmn-toggle-1").prop('checked')) {
                    console.log("チェックされています。");
                    $("span.translate").next().show();
                    $("span.translate").hide();
                    $("div.translate").show();
                    $("div.translate").prev().hide();
                } else {
                    console.log("チェックされていません。");
                    $("span.translate").next().hide();
                    $("span.translate").show();
                    $("div.translate").hide();
                    $("div.translate").prev().show();
                }
            });
        } catch (error) { console.log(error); }
        try {//要素処理リスト系の初期設定等、
            $('#contents *:not(span,.im,p,.mv_slide div,h1,h2,h3)>img').each(function (i) {
                $(this).wrap('<figure class="im">');
            });
            $('[class*=it0],[class*=ti0]').each(function (i) {
                newel = '';
                if (!$(this).find('article').length && !$(this).find('div[id]').length) {
                    newel = $(this).wrapInner('<article>');
                }
            });
            $("[class*='it0'],[class*='ti0']").find("article").each(function () {
                $(this).find(">.im, .itext").insertBefore($(this));
            });
            $(' div:not(.insta_flow,.subbanner01)>.box').each(function (i) {//.box構造の調整
                if (!$(this).find('article').length) {
                    newel = $(this).wrapInner('<article>');
                }
            });
            $(".p-hashSplit p").each(function () {// #でh_nav aをspan分離
                let tx = $(this).text();
                if (tx.indexOf("#") >= 0) {
                    let array = $(this).html().split('#');
                    // console.log(array);
                    $(this).html(array[0] + '<span>' + array[1] + '</span>')
                    // $(this).html('<span>' + array[0] + '</span>' + array[1])
                    // $(this).html('<dt>' + array[0] + '</dt><dd>' + array[1] + '</dd>')
                }
            });
        } catch (error) { console.log(error); }
        try {//その他class処理
    
            $('.budoux').wrapInner('<budoux-ja>');//autoPhrase(文節改行)
            $('.blog_list a').attr('target', '_self');
            $(".policy-trigger,.policy-wrap").on("click", function () {
                $(".policy-wrap").toggleClass("active");
            });
            $('p.annot').insertAfter('.form_wrap.entry');
            $('div.submit').insertAfter('.annot');
            $('.wrapInner :is(h1,h2,h3,.h1FZ,.h2FZ,.h3FZ):not(.h1-in h1),.H-mark :is(h1,h2,h3,h4)').wrapInner('<mark>');
    
            $('.imgToMask>*').each(function (i) {
                src = $(this).find('img').attr('src');
                $(this).find('.im').attr('style', `mask-image:url(/${src})`);
            });
    
            $('.brSplit-li').html(function () {//全て囲む
                return $(this).html().replace(/\n/g, '').split("<br>").filter(function (x) {
                    return x.match(/\S/);
                }).map(function (x) {
                    return "<li>" + x + "</li>";
                }).join("");
            });
    
        } catch (error) { console.log(error); }
        try {// fancybox
            $('.fancybox li,.fancybox .box').each(function (i) {//画像ソース自動入力
                src = $(this).find('img').wrap('<a class="popup__a">').addClass('popup__img').attr('src');
                // console.log(src);
                $(this).find('.popup__a').attr('href', `${src}`)
            });
            $('.fancybox').magnificPopup({//ポップアップ figcaptionにテキスト表示はsrcを直接入れる必要あり(↑コメントアウト)
                delegate: 'a',
                type: 'image',
                removalDelay: 600,
                gallery: {
                    enabled: true
                },
                preloader: true,
            });
        } catch (error) { console.log(error); }
        try {//horizontal scroll //scroll-hint 横スクロール＞できます」表示 
            new ScrollHint('.__Xscr, .tbl_scroll', {
                i18n: {
                    scrollable: 'スクロールできます'
                }
            });
            let scrollElement = document.querySelectorAll(".__Xscr, .tbl_scroll");
    
            scrollElement.forEach((el) => {
                el.addEventListener("wheel", (e) => {
                    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
                    let maxScrollLeft = el.scrollWidth - el.clientWidth;
                    if (
                        (el.scrollLeft <= 0 && e.deltaY < 0) ||
                        (el.scrollLeft >= maxScrollLeft && e.deltaY > 0)
                    )
                        return;
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                });
            });
        } catch (error) { console.log(error); }
        try {//スライダー
            let slideRate = 3000;
            let slideFade = 600;
            $('.mv_switch').each(function (i) { $(this).attr('style', `--rate:${slideRate + slideFade}ms`); });
            $(".mv_slide ul,.op_slide ul,.mv_switch,.bg_slide ul").slick({
                autoplay: false,
                fade: true,
                slidesToShow: 1,
                arrows: false,
                dots: false,
                // adaptiveHeight: true,
    
                autoplaySpeed: `${slideRate}`,
                speed: `${slideFade}`,
                cssEase: "ease-in-out",
                // vertical: true,
                infinite: true,
                useCSS: true,
                pauseOnFocus: false, //スライダーをフォーカスした時にスライドを停止させるか
                pauseOnHover: false, //スライダーにマウスホバーした時にスライドを停止させるか
                // responsive: [
                //     { breakpoint: 960, settings: { slidesToShow: 1 } }
                // ]
            });
            // $(".mv_slide .slick-arrow,.mv_slide .slick-dots").wrapAll('<div class="arrows">');
            $(".sns_slide .sns_list, .ul_slide ul, .card_slide, .blog_slide .blog_list").each(function () {
                const $slider = $(this);
                const isReverse = $slider.hasClass("__rev");
                const isVer2 = $slider.hasClass("__ver2");
    
                if (isReverse) {
                    $slider.attr("dir", "rtl");
                }
    
                function removeActiveClasses($slides) {
                    const classList = Array.from({ length: 10 }, (_, i) => 'visible' + (i + 1));
                    $slides.removeClass(classList.join(' '));
                }
    
                function addUpcomingActiveClasses(slick, nextSlide) {
                    const slidesToShow = slick.options.slidesToShow;
                    const slideCount = slick.slideCount;
                    const $allSlides = slick.$slider.find('.slick-slide');
    
                    // クローンを含むのでindexの調整が必要（以下は最も安全）
                    const realIndexes = [];
    
                    for (let i = 0; i < slidesToShow; i++) {
                        let targetIndex = (nextSlide + i) % slideCount;
                        realIndexes.push(targetIndex);
                    }
    
                    removeActiveClasses($allSlides);
    
                    $allSlides.each(function () {
                        const $slide = $(this);
                        const index = parseInt($slide.attr('data-slick-index'), 10);
    
                        const posInView = realIndexes.indexOf((index + slideCount) % slideCount);
                        if (posInView !== -1 && posInView < 10) {
                            $slide.addClass('visible' + (posInView + 1));
                        }
                    });
                }
    
                if (isVer2) {
                    $slider.on('beforeChange', function (event, slick, currentSlide, nextSlide) {
                        addUpcomingActiveClasses(slick, nextSlide);
                    });
    
                    $slider.on('init', function (event, slick) {
                        addUpcomingActiveClasses(slick, slick.currentSlide || 0);
                    });
                }
    
                $slider.slick({
                    autoplaySpeed: 5400,
                    speed: 900,
                    cssEase: "ease-out",
                    slidesToShow: isVer2 ? 5 : 4,
                    arrows: true,
                    dots: false,
                    useCSS: true,
                    pauseOnHover: true,
                    rtl: isReverse,
                    responsive: [
                        { breakpoint: 1081, settings: { slidesToShow: 3 } },
                        {
                            breakpoint: 835, settings: {
                                slidesToShow: isVer2 ? 3 : 2,
                            }
                        }
                    ]
                });
                // ホイールで横スクロールする機能（条件付き）
                $slider.on('wheel', function (e) {
                    const delta = e.originalEvent.deltaY;
    
                    // slick-track要素を取得
                    const $track = $(this).find('.slick-track');
    
                    // slick-trackの画面上の位置を取得
                    const trackRect = $track[0].getBoundingClientRect();
    
                    // 条件①：縦方向に画面に収まっているか
                    const isVerticallyVisible = trackRect.top >= 0 && trackRect.bottom <= window.innerHeight;
    
                    // 条件②：カーソルが上にある
                    const isHovered = $(e.target).closest('.slick-track').length > 0;
    
                    if (isVerticallyVisible && isHovered) {
                        e.preventDefault();
    
                        if (delta > 0) {
                            $slider.slick('slickNext');
                        } else {
                            $slider.slick('slickPrev');
                        }
                    }
                });
            });
    
    
    
    
            // $(".sns_slide .sns_list, .ul_slide ul, .card_slide, .blog_slide .blog_list").slick({//サブスライダー
            //     autoplay: true,
            //     // autoplaySpeed: 6000, //自動再生のスライド切り替えまでの時間を設定
            //     // speed: 1200, //スライドが流れる速度を設定
            //     cssEase: "ease-in-out", //スライドの流れ方を等速に設定
            //     slidesToShow: 7, //表示するスライドの数
            //     arrows: false,
            //     dots: true,
            //     useCSS: true,
            //     pauseOnHover: true, //スライダーにマウスホバーした時にスライドを停止させるか
            //     autoplaySpeed: 0, //自動再生のスライド切り替えまでの時間を設定
            //     speed: 12000, //スライドが流れる速度を設定
            //     cssEase: "linear", //スライドの流れ方を等速に設定
            //     responsive: [
            //         { breakpoint: 1440, settings: { slidesToShow: 5 } },
            //         { breakpoint: 960, settings: { slidesToShow: 3, } },
            //         {
            //             breakpoint: 834,
            //             settings: {
            //                 slidesToShow: 2
            //             }
            //         },
            //         // { breakpoint: 640, settings: { slidesToShow: 2 } }
            //     ]
            // });
            // $(".card_slide .box").addClass('js-bottom');
    
            $('.thumb_slide ul').slick({//ドットが画像のスライダー
                dots: true,
                // autoplay: true,
                arrows: false,
                // fade: true,
                autoplaySpeed: 4000,
                speed: 500,
                slidesToShow: 1,
                adaptiveHeight: true,
                customPaging: function (slick, index) {
                    // スライダーのインデックス番号に対応した画像のsrcを取得
                    var targetImage = slick.$slides.eq(index).find('img').attr('src');
                    // slick-dots > li　の中に上記で取得した画像を設定
                    return '<img src=" ' + targetImage + ' "/>';
                },
                responsive: [
                    // { breakpoint: 1401,settings: {slidesToShow: 4}  },
                    // { breakpoint: 1001,settings: {slidesToShow: 3}  },
                    {
                        breakpoint: 641,
                        settings: {
                            slidesToShow: 1
                        }
                    },
                    // {breakpoint: 641,settings: {slidesToShow: 2 }}
                ]
            });
    
            new ScrollHint('.__scroll .slick-dots', {//horizontal scroll //scroll-hint 横スクロール＞できます」表示 
                i18n: {
                    scrollable: 'スクロールできます'
                }
            });
            let scrollElement = document.querySelectorAll(".__scroll .slick-dots");
    
            scrollElement.forEach((el) => {
                el.addEventListener("wheel", (e) => {
                    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
                    let maxScrollLeft = el.scrollWidth - el.clientWidth;
                    if (
                        (el.scrollLeft <= 0 && e.deltaY < 0) ||
                        (el.scrollLeft >= maxScrollLeft && e.deltaY > 0)
                    )
                        return;
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                });
            });
    
        } catch (error) { console.log(error); }
    
        try {//パンくず
            const H1 = document.querySelector('.title1 h1 ');// h1を指定している要素を取得
            const CURRENT_PAGE_URL = location.href;// 現在のurlを取得
            const HOME_PAGE_URL = `https://${location.host}`;// トップページのurlを取得
            const PAN = document.querySelector('.pankuzu');// パンくずを表示させる要素を取得
            const HOME_TEXT = document.querySelector('.f_copy>span ').textContent + "　ホーム";// トップページのリンクテキストを設定
            // const HOME_TEXT = document.querySelector('.f_copy>span ').textContent;// トップページのリンクテキストを設定
            if (H1) {
                const H1_TEXT = document.querySelector('.title1 h1+div ').textContent;// 現在のh1テキストからリンクテキストを設定
    
                const BREADCRUMB_HTML = `
            <ul itemscope="itemscope" itemtype="https://schema.org/BreadcrumbList">
                <li itemprop="itemListElement" itemscope="itemscope" itemtype="https://schema.org/ListItem">
                    <meta itemprop="position" content="1">
                    <a itemprop="item" itemscope="itemscope" itemtype="http://schema.org/Thing" href="${HOME_PAGE_URL}" itemid="${HOME_PAGE_URL}">
                        <meta itemprop="name" content="${HOME_TEXT}">
                        ${HOME_TEXT}
                    </a>
                </li>
                <li>></li>
                <li>${H1_TEXT}</li>
            </ul>
            `
                PAN.insertAdjacentHTML('afterbegin', BREADCRUMB_HTML);
            }
        } catch (error) { console.log(error); }
        try {//ページ毎処理
            // let pageT = location.pathname.slice(1).replace(".html", "");
            // let param = location.search;
            // let html = $('html');
            // if (pageT == "" || pageT.includes("index") || param.includes("page=776&token")) {
            //     html.addClass("home");
            //     if ($("li>a[href*='index.html']")) {
            //         $("li>a[href*='index.html']").each(function (i) {
            //             ANC = $(this).attr('href').replace('index.html', '');
            //             // ANC = $(this).attr('href');
            //             // console.log(ANC); 
            //             $(this).attr('href', `${ANC}`)
            //         });
            //     }
            // }
            // else {
            //     $('.h').addClass('trans');
            //     if (pageT.includes("blog")) {
            //         html.addClass("blog");
            //         $(".h_nav ul li a").each(function () {// #でh_nav aをspan分離
            //             let tx = $(this).text();
            //             if (tx.indexOf("#") >= 0) {
            //                 let array = $(this).html().split('#');
            //                 $(this).html(array[0] + '<span>' + array[1] + '</span>')
            //             }
            //         });
            //     }
            //     else
            //     if (pageT.includes("shop")) {
            //         // html.addClass("shop");
            //         // let newel = $('<div class="title1" style="margin-top:unset;"><article  class="title1_inner" style="text-align:center;"><h1 class=""><span class="">オンラインショップ</span><small>Online Shop</small></h1></article></div>').appendTo($('#global_header'));
            //         // let newel = $('<div class="title1" style="background-image: url(/images/home/title1.jpg);"><article  class="title1_inner" style="text-align:left;"><h1 class=" " style=""><em style="color:#fff">Shopping</em><span class="">お買い物</span></h1></article></div>').appendTo($('#global_header'));
            //         // $('section>div.crumb>ul').insertAfter('.item_view>h2');
            //     }
    
            // }
        } catch (error) { console.log(error); }
    
        try {// Jquery slideToggle
            $(".dl_qa.firstopen dl:first-child dt").addClass('show');
            $(".dl_qa dl dt").click(function () {
                $(this).next("dd").stop().slideToggle();
                $(this).toggleClass('show');
            });
            $(".fb_qa.__open .box ").addClass('show').next(".box").stop().slideToggle();
            $(".fb_qa .box:nth-child(odd)").click(function () {
                $(this).next(".box").stop().slideToggle();
                $(this).toggleClass('show');
            });
        } catch (error) { console.log(error); }
    
        try {//navigation
            $(".h_nav ul li a").each(function () {// #でh_nav aをspan分離
                let tx = $(this).text();
                if (tx.indexOf("#") >= 0) {
                    let array = $(this).html().split('#');
                    // console.log(array);
                    $(this).html(array[0] + '<span>' + array[1] + '</span>')
                    // $(this).html('<span>' + array[0] + '</span>' + array[1])
                    // $(this).html('<dt>' + array[0] + '</dt><dd>' + array[1] + '</dd>')
                }
            });
    
            // sp用($menu以下)のナビゲーション
            $(".h_nav").clone().attr("id", "navsp").removeClass().addClass("nav").wrapInner('<div class="nav_inner">').insertAfter('.h_nav');
    
            MENU = document.querySelector(".h_menu");
            navpc = document.querySelector(".h_nav");
            HnavA = document.querySelectorAll(".h_nav a");
            cont = document.querySelector("#contents");
            navsp = document.querySelector("#navsp");
            navul = document.querySelector("#navsp ul");
            menutoggle = document.querySelectorAll(".menu_toggle, .nav a:not(.nopointer,.drop_toggle)");
            contact = document.querySelectorAll(".h_items a");
            Dtoggle = document.querySelectorAll(".drop_toggle");
            Ghdr = document.querySelector("#global_header");
            hdr = document.querySelector('#header');
            focustrap = document.querySelector('.focus_trap');
    
            const btnPress = () => {
                navpc.inert = navpc.inert === true ? false : true;
                navsp.classList.toggle("show");
                navul.classList.toggle("show");
                MENU.ariaPressed = MENU.ariaPressed === "true" ? "false" : "true";
                MENU.ariaExpanded = MENU.ariaExpanded === "true" ? "false" : "true";
                MENU.ariaLabel =
                    MENU.ariaLabel === "menu open" ?
                        "menu close" :
                        "menu open";
                hdr.classList.toggle("active");
                MENU.classList.toggle("active");
            };
            // btnPress();
    
            HnavA.forEach((el) => {
                el.addEventListener("click", () => {
                    setTimeout(() => {
                        el.blur();
                        console.log(878);
                    }, 600);
                });
            });
            contact.forEach((el) => {
                el.addEventListener("click", () => {
                    if (hdr.classList.contains("active")) {
                        btnPress();
                    }
                });
            });
            menutoggle.forEach((el) => {
                el.addEventListener("click", () => {
                    // if (innerWidth <= 1200) {
                    btnPress();
                    // }
                });
            });
            focustrap.addEventListener("focus", () => {
                MENU.focus();
            });
            window.onkeyup = function (event) {
                if (event.keyCode == '27' && MENU.ariaPressed === "true") {
                    btnPress();
                }
            }
            // window.addEventListener("keydown", () => {
            //     if (MENU.ariaPressed === "true") {
            //         if (event.key === "Escape") {
            //             btnPress();
            //         }
            //     }
            // });
    
            // アコーディオン開閉 
            const dropDown = (el) => {
                parent = el.closest('li');
                target = el.closest('li').querySelector('ul');
                target.classList.toggle("show");
                el.classList.toggle("active");
                parent.ariaExpanded = parent.ariaExpanded === "true" ? "false" : "true";
                target.ariaHidden = target.ariaHidden === "false" ? "true" : "false";
                target.ariaLabel = target.ariaLabel === "open" ? "close" : "open";
            }
            // $('.drop ').each(function (i) { //add custom prop
            //     let num = $(this).find('ul li').length;
            //     let ah = $(this).find('a').outerHeight();
            //     $(this).attr('style', `--li:${num};--h:${ah}px`)
            // });
            Dtoggle.forEach((el) => {
                el.addEventListener("click", () => {
                    dropDown(el);
                });
            });
    
        } catch (error) { console.log(error); }
    });
    
    document.addEventListener('DOMContentLoaded', function () {//tabタブ　架空サイト GenerateBox canvas生成
        document.querySelectorAll('.tabContainer').forEach((container, containerIndex) => {
            const tabs = container.querySelectorAll('.tab');
            const panels = container.querySelectorAll('.tabPanel');
            const tabList = container.querySelector('.tabButtons');
            const nextButton = container.querySelector('.tab-next-button');
            let currentIndex = 0;
        
            tabList.setAttribute('role', 'tablist');
        
            tabs.forEach((tab, i) => {
                const tabId = `tab-${containerIndex}-${i}`;
                const panelId = `panel-${containerIndex}-${i}`;
        
                if (!panels[i]) return;
        
                tab.setAttribute('role', 'tab');
                tab.setAttribute('id', tabId);
                tab.setAttribute('aria-controls', panelId);
                tab.setAttribute('tabindex', i === 0 ? '0' : '-1');
                tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        
                panels[i].setAttribute('role', 'tabpanel');
                panels[i].setAttribute('id', panelId);
                panels[i].setAttribute('aria-labelledby', tabId);
                panels[i].hidden = i !== 0;
                if (i === 0) panels[i].classList.add('show');
        
                // ▼ 通常タブ切り替え（PC用）
                tab.addEventListener('click', () => {
                    activateTab(i);
                });
        
                tab.addEventListener('keydown', (e) => {
                    let newIndex = null;
                    switch (e.key) {
                        case 'ArrowRight': newIndex = (i + 1) % tabs.length; break;
                        case 'ArrowLeft': newIndex = (i - 1 + tabs.length) % tabs.length; break;
                        case 'Home': newIndex = 0; break;
                        case 'End': newIndex = tabs.length - 1; break;
                    }
                    if (newIndex !== null) {
                        e.preventDefault();
                        tabs[newIndex].focus();
                        activateTab(newIndex);
                    }
                });
            });
        
            // ▼ スマホ用「次へ」ボタン
            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    const nextIndex = (currentIndex + 1) % panels.length;
                    activateTab(nextIndex);
                });
            }
        
            function activateTab(activeIndex) {
                tabs.forEach((tab, j) => {
                    const panel = panels[j];
                    tab.setAttribute('aria-selected', activeIndex === j ? 'true' : 'false');
                    tab.setAttribute('tabindex', activeIndex === j ? '0' : '-1');
                    if (panel) {
                        panel.hidden = activeIndex !== j;
                        panel.classList.toggle('show', activeIndex === j);
                    }
                });
                currentIndex = activeIndex;
                // SPではボタンで切り替えなのでフォーカス不要
                if (window.innerWidth > 834) {
                    tabs[activeIndex].focus({ preventScroll: true });
                }
                
                // タブ切り替え後に画像処理を実行
                setTimeout(() => {
                    const activePanel = panels[activeIndex];
                    if (activePanel) {
                        const images = activePanel.querySelectorAll('.GenerateBox img');
                        images.forEach(img => {
                            if (img.dataset.processed) return;
                            if (img.complete && img.naturalWidth > 0) {
                                splitImage(img);
                            } else {
                                img.onload = () => splitImage(img);
                            }
                        });
                    }
                }, 50);
            }
        
            activateTab(0); // 初期表示
            
            // 初期表示後に最初のタブの画像を処理
            setTimeout(() => {
                const firstPanel = panels[0];
                if (firstPanel) {
                    const images = firstPanel.querySelectorAll('.GenerateBox img');
                    images.forEach(img => {
                        if (img.complete && img.naturalWidth > 0) {
                            splitImage(img);
                        } else {
                            img.onload = () => splitImage(img);
                        }
                    });
                }
            }, 100);
        });
        
    
        // 画像を分割する関数（グローバルスコープに配置）
        function splitImage(img) {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            // 寸法が取得できない場合はスキップ
            if (!width || !height) {
                console.warn('画像の寸法が取得できません:', img.src);
                return;
            }
            
            // 処理済みマークを付ける
            img.dataset.processed = 'true';

            const canvasA = document.createElement('canvas');
            const canvasB = document.createElement('canvas');
            canvasA.width = canvasB.width = width;
            canvasA.height = canvasB.height = height;

            const ctxA = canvasA.getContext('2d');
            const ctxB = canvasB.getContext('2d');

            ctxA.drawImage(img, 0, 0, width, height);
            ctxB.drawImage(img, 0, 0, width, height);

            const rects = [];
            for (let i = 0; i < 50; i++) {
                const ratio = [[1, 1], [1, 2], [2, 1]][Math.floor(Math.random() * 3)];
                const baseSize = Math.floor(Math.random() * (width / 10)) + 100;
                const w = ratio[0] > ratio[1] ? baseSize : Math.floor(baseSize * ratio[0] / ratio[1]);
                const h = ratio[1] > ratio[0] ? baseSize : Math.floor(baseSize * ratio[1] / ratio[0]);

                const expandedWidth = width * 1.5;
                const expandedHeight = height * 1.5;
                const offsetX = -width * 0.25;
                const offsetY = -height * 0.25;

                const x = Math.floor(Math.random() * (expandedWidth - w)) + offsetX;
                const y = Math.floor(Math.random() * (expandedHeight - h)) + offsetY;

                rects.push({ x, y, w, h });
            }

            ctxA.clearRect(0, 0, width, height);
            ctxA.save();
            ctxA.beginPath();
            rects.forEach(r => ctxA.rect(r.x, r.y, r.w, r.h));
            ctxA.clip();
            ctxA.drawImage(img, 0, 0);
            ctxA.restore();

            ctxB.save();
            ctxB.beginPath();
            rects.forEach(r => ctxB.rect(r.x, r.y, r.w, r.h));
            ctxB.clip();
            ctxB.clearRect(0, 0, width, height);
            ctxB.restore();
            ctxB.globalCompositeOperation = 'destination-in';
            ctxB.drawImage(img, 0, 0);
            ctxB.globalCompositeOperation = 'source-over';

            const container = img.parentElement;
            container.appendChild(canvasA);
            container.appendChild(canvasB);
        }
    });
    
    
    document.addEventListener('DOMContentLoaded', function () {//IntersectionObserver カウントアップ
        try {
            const countUpElements = document.querySelectorAll(".countUp");
    
            if (countUpElements.length > 0) {
                const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
                    document.documentElement.classList.contains("reduced");
    
                const animateCounter = (entries, observer) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
    
                        const el = entry.target;
                        if (el.dataset.animated) return;
                        el.dataset.animated = "true";
    
                        const endValue = parseInt(el.textContent.replace(/,/g, ""), 10);
                        if (isNaN(endValue)) return;
    
                        if (isReducedMotion) {
                            // アニメーションをスキップして最終値を即座に表示
                            el.textContent = endValue.toLocaleString("en-US");
                        } else {
                            const duration = 1500;
                            let startTime = null;
    
                            const step = timestamp => {
                                if (!startTime) startTime = timestamp;
                                const progress = Math.min((timestamp - startTime) / duration, 1);
                                const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
                                const current = Math.ceil(eased * endValue);
                                el.textContent = current.toLocaleString("en-US");
    
                                if (progress < 1) {
                                    requestAnimationFrame(step);
                                } else {
                                    el.textContent = endValue.toLocaleString("en-US");
                                }
                            };
    
                            el.textContent = "0";
                            requestAnimationFrame(step);
                        }
    
                        observer.unobserve(el);
                    });
                };
    
                const observer = new IntersectionObserver(animateCounter, {
                    rootMargin: "0px 0px -10% 0px",
                    threshold: 0
                });
    
                countUpElements.forEach(el => observer.observe(el));
            }
    
            const Once = document.querySelectorAll( //一度
                ".u-rad,[class*=js-]:not([class*=js-art],[class*=js-ch],.js-letter,.js-bgFix),[class*=js-art] article>*,[class*=js-ch]>*,.js-letter,.img_outer,.H-split :is(h1,h2,h3)>span,.div-split div>*"
            );
            const observerO = new IntersectionObserver(IOonce, {
                rootMargin: "0% 0% -15% 0px",
                threshold: 0,
                // root: document.body,
            });
            function IOonce(entries) {
                entries.forEach(function (entry, i) {
                    const target = entry.target;
                    if (entry.isIntersecting) {
                        target.classList.add("show");
                    }
                });
            }
            const Toggle = document.querySelectorAll(// フェードインアウト
                ".f_main,.js-bgFix"
            );
            const observerT = new IntersectionObserver(IOtoggle, { rootMargin: "-0% 0% -50% 0px", });
            function IOtoggle(entries) {
                entries.forEach(function (entry, i) {
                    const target = entry.target;
                    if (entry.isIntersecting) { target.classList.add("show"); }
                    else { target.classList.remove("show"); }
                });
            }
    
            // .mv_switch用調整
            // const observerH = new IntersectionObserver(IOhead, { rootMargin: "100% 0% -0% 0px", threshold: .0 });
    
            // if (window.innerWidth <= 1080) {
            //     const observerH = new IntersectionObserver(IOhead, { rootMargin: "-0% 0% -0% 0px", threshold: 0.5 });
            //     head.forEach((tgt) => { observerH.observe(tgt); });
            // } else {}
            // header trans
            const head = document.querySelectorAll(//ヘッダー変形 .trans or .init
                ".mv,.First ,.title1"
            );
            const observerH = new IntersectionObserver(IOhead, { rootMargin: "-0% 0% -0% 0px", threshold: 0.8 });
            function IOhead(entries) {
                entries.forEach(function (entry, i) {
                    const header = document.querySelector('#header');
                    if (entry.isIntersecting) {
                        // header.classList.remove('trans');
                        header.classList.add('init');
                    }
                    else {
                        // header.classList.add('trans');
                        header.classList.remove('init');
                    }
                });
            }
    
    
            const slide = document.querySelectorAll("[class*=_slide]");// スライド
            const observerS = new IntersectionObserver(IOslide, { rootMargin: "-0% 0% -0% 0px", threshold: 0.5 });
            function IOslide(entries) {
                entries.forEach(function (entry, i) {
                    const targetID = entry.target.id;
                    const target = $(`#${targetID}`);
                    if (entry.isIntersecting) {
                        // console.log(target);
                        try {
                            target.find('ul,>div').slick('slickPlay');
                        } catch (e) { }
                    }
                    else {
                        try {
                            target.find('ul,>div').slick('slickPause');
                        } catch (e) { }
                    }
                });
            }
    
    
            Once.forEach((tgt) => { observerO.observe(tgt); });
            head.forEach((tgt) => { observerH.observe(tgt); });
            Toggle.forEach((tgt) => { observerT.observe(tgt); });
            slide.forEach((tgt) => { observerS.observe(tgt); });
    
            // var webStorage = function () {// 
            //     // document.querySelector('body').setAttribute("style", "opacity:1;");
            //     setTimeout(function () {
            //         // anc.forEach((tgt) => { observerB.observe(tgt); });
            //     }, 300);
            // }
            // webStorage();
    
        } catch (error) { console.log(error); }
    
        try {// alt無しにcopy ブログサムネないときロゴ
            COPY = $('.f_copy>span').text();
            $('img').each(function () {// add alt
                if ($(this).is('[alt=""]')) {
                    $(this).attr('alt', `${COPY}`);
                }
                // $(this).on("error", function () {
                //     console.log("画像が指定されていません");
                //     $(this).attr("src", "/images/home/logo.png");
                // });
                // $(this).attr({//画像保存対策
                //     oncontextmenu: 'return false',
                //     draggable: 'false',
                // });
            });
            $('.blog_list>div').each(function () {
                photo = $(this).find('.blog_photo')
                if (!photo.find('>a').length) {
                    href = $(this).find('.blog_text h3>a').attr('href')
                    newel = $('<a target="_self"><img src="/images/home/logo.png" alt=""></a>').appendTo(photo);
                    photo.find('a').attr('href', `${href}`);
                } else { }
            });
    
        } catch (error) { console.log(error); }
    });
    document.addEventListener('DOMContentLoaded', function () { // シャッフルテキスト shuffle
        const html = document.documentElement;
        const shuffleElements = document.querySelectorAll(".shuffle");
    
        const shuffleObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting &&
                        !entry.target.hasAttribute('data-shuffled') &&
                        !html.classList.contains('reduced')
                    ) {
                        entry.target.setAttribute('data-shuffled', 'true');
                        shuffleTextAnimation(entry.target);
                    } else {
                        // 画面から出た時の処理
                        // resetShuffleElement(entry.target);
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: "0px 0px -20% 0px",
            }
        );
    
        // 要素の初期化処理をリファクタリング
        const initializeShuffleElement = (element) => {
            // 元のコンテンツを保存
            const originalHTML = element.innerHTML;
            element.setAttribute('data-original-html', originalHTML);
    
            // 現在のサイズを取得
            const rect = element.getBoundingClientRect();
    
            // 中身をspanで包装
            const contentSpan = document.createElement('span');
            contentSpan.innerHTML = originalHTML;
    
            // 親要素にコンテナクラスを追加し、サイズを固定
            element.style.height = `${rect.height}px`;
            element.style.width = `${rect.width}px`;
    
            // 元の内容をクリアしてspanを挿入
            element.innerHTML = '';
            element.appendChild(contentSpan);
    
            // spanを参照として保存
            element.contentSpan = contentSpan;
    
            return contentSpan;
        };
    
        shuffleElements.forEach((shuffleTarget) => {
            initializeShuffleElement(shuffleTarget);
            shuffleObserver.observe(shuffleTarget);
        });
    
        // シャッフル要素をリセットする関数
        function resetShuffleElement(element) {
            // アニメーション中断
            if (element.shuffleTimer) {
                clearTimeout(element.shuffleTimer);
                element.shuffleTimer = null;
            }
    
            // contentSpanを取得
            const contentSpan = element.contentSpan;
            if (contentSpan) {
                // 元のHTMLに戻す
                const originalHTML = element.getAttribute('data-original-html');
                if (originalHTML) {
                    contentSpan.innerHTML = originalHTML;
                }
    
                // 非表示にする（CSSクラスで制御）
                contentSpan.classList.remove('show');
            }
        }
    
        function shuffleTextAnimation(element) {
            if (html.classList.contains('reduced')) return;
    
            const contentSpan = element.contentSpan;
            if (!contentSpan) return;
    
            contentSpan.classList.add('show');
    
            const config = {
                shuffleCount: 1,
                restoreSteps: 10,
                interval: 50,
                delay: 100
            };
    
            const originalHTML = element.getAttribute('data-original-html');
            const originalParts = parseHTMLToParts(originalHTML);
    
            executeShuffleAnimation(element, contentSpan, originalParts, originalHTML, config);
        }
    
        // HTML解析を独立した関数に
        function parseHTMLToParts(html) {
            const parts = [];
            const regex = /(<br\s*\/?>|&[a-zA-Z0-9#]+;|.)/gi;
            let match;
    
            while ((match = regex.exec(html)) !== null) {
                parts.push(match[0]);
            }
    
            return parts;
        }
    
        // フィッシャー・イェーツシャッフル
        function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
    
    
        // シャッフルアニメーション実行
        function executeShuffleAnimation(element, contentSpan, originalParts, originalHTML, config) {
            let shuffleStep = 0;
    
            const performShuffle = () => {
                if (shuffleStep < config.shuffleCount) {
                    contentSpan.innerHTML = shuffleArray([...originalParts]).join('');
                    shuffleStep++;
                    element.shuffleTimer = setTimeout(performShuffle, config.interval);
                } else {
                    startRestore();
                }
            };
    
            const startRestore = () => {
                const shuffledState = shuffleArray([...originalParts]);
                let restoreStep = 0;
    
                const restoreNext = () => {
                    if (restoreStep < config.restoreSteps) {
                        const progress = (restoreStep + 1) / config.restoreSteps;
                        const targetCount = Math.floor(originalParts.length * progress);
    
                        const partialRestore = [...shuffledState];
                        for (let i = 0; i < targetCount; i++) {
                            partialRestore[i] = originalParts[i];
                        }
    
                        contentSpan.innerHTML = partialRestore.join('');
                        restoreStep++;
                        element.shuffleTimer = setTimeout(restoreNext, config.interval);
                    } else {
                        contentSpan.innerHTML = originalHTML;
                        element.shuffleTimer = null;
                    }
                };
    
                restoreNext();
            };
    
            element.shuffleTimer = setTimeout(performShuffle, config.delay);
        }
        return;
    
    });
    
    document.addEventListener('DOMContentLoaded', function () {//旧function 要添削
        /* ##### START JQUERY TEMPLATE ##################################### */
        // rollover(".siteID a img", 0.6, 200);
        // spAutoTel(".call", "03-5645-3691");
        // spAutoTel(".call2", "06-6484-6284");
        // spAutoTel(".call3", "0120-650-701");
        // spAutoTel(".call4", "0120-853-691");
        // objectFitImages();
        // pankuzu("イートラスト株式会社 ホーム");
        /* ##### START JQUERY ############################################## */
        $(".s-news").appendTo("#global_header");
        $(".box article > h3").remove();
        $(".form_wrap dt label").text("必須");
        $(".dsnone").remove();
        $(".title_01")
            .find("div")
            .each(function () {
                $(this)
                    .prev("h1,h2")
                    .append("<span>" + $(this).text() + "</span>");
                $(this).remove();
            });
        $(".service")
            .find("h3")
            .each(function () {
                $(this).next("div").prepend($(this));
            });
        $(".service .box").each(function () {
            let href = $(this).find("a").attr("href");
            $(this).find("a").contents().unwrap();
            $(this)
                .find("article")
                .wrap('<a href="' + href + '" />');
        });
        $(".flow")
            .find("h3")
            .each(function () {
                $(this).next("div").prepend($(this));
            });
        var path = location.pathname;
        if (path == "/contact.html.php") {
            $("header").prepend(
                '<div class="subArea title_01"><article><h1>CONFIRM<span>お問い合わせ内容</span></h1></article></div>'
            );
        }
        if ($(".h1txt").length) {
            var h1Txt = $(".h1txt").text();
            $("#subArea").prepend("<h1>" + h1Txt + "</>");
            $(".h1txt").remove();
        }
        if (path !== "/") {
            let loader = $(".loader-wrap");
            $(window).on("load", function () {
                loader
                    .fadeOut(800)
                    .promise()
                    .done(function () {
                        $("body").addClass("load_end");
                    });
            });
            setTimeout(function () {
                loader
                    .fadeOut(800)
                    .promise()
                    .done(function () {
                        $("body").addClass("load_end");
                    });
            }, 3000);
        }
        $(".main_logo").on("animationend webkitAnimationEnd", function () {
            setTimeout(function () {
                $("body").addClass("load_end");
            }, 1000);
        });
    
        $(".slider").on("init", function (event, slick) {
            console.log("Slider has been initialized.");
        });
    
        $(".slider").slick({
            arrows: false,
            autoplay: true,
            speed: 1000,
            autoplaySpeed: 4000,
            pauseOnFocus: false,
            pauseOnHover: false,
            centerMode: true,
            slidesToShow: 2,
            draggable: false,
            swipe: false,
            centerPadding: "396px",
            responsive: [
                {
                    breakpoint: 1401,
                    settings: {
                        centerPadding: "200px",
                    },
                },
                {
                    breakpoint: 1025,
                    settings: {
                        centerPadding: "100px",
                    },
                },
                {
                    breakpoint: 641,
                    settings: {
                        centerPadding: "32px",
                    },
                },
            ],
        });
    
        $(".slider2").slick({
            autoplay: true,
            arrows: true,
            speed: 1000,
            autoplaySpeed: 4000,
            pauseOnFocus: false,
            pauseOnHover: false,
            slidesToShow: 4,
            slidesToScroll: 1,
            responsive: [
                {
                    breakpoint: 1401,
                    settings: {
                        slidesToShow: 3,
                    },
                },
                {
                    breakpoint: 1025,
                    settings: {
                        slidesToShow: 2,
                    },
                },
                {
                    breakpoint: 641,
                    settings: {
                        slidesToShow: 1,
                    },
                },
            ],
        });
    
        $(".slick-prev,.slick-next").appendTo(".s-works__button");
    
        $(document).ready(function () {
            $(window).on("scroll", function () {
                let contents = $("#contents_wrap");
                if (contents.length > 0) {
                    let offset = contents.offset();
                    let scroll = $(window).scrollTop();
                    let windowHeight = $(window).height();
    
                    if (scroll > offset.top) {
                        $(".siteID").find(".gray").addClass("active");
                        $(".siteID").find(".white").removeClass("active");
                    } else {
                        $(".siteID").find(".gray").removeClass("active");
                        $(".siteID").find(".white").addClass("active");
                    }
    
                    $(".odometer").each(function () {
                        let position = $(this).offset().top;
                        if (scroll > position - windowHeight + 100) {
                            setTimeout(function () {
                                $(".odometer").html(10000);
                            }, 10);
                        }
                    });
    
                    $(".anime-left,.anime-bottom,.anime-slide").each(function () {
                        let position = $(this).offset().top;
                        if (scroll > position - windowHeight + 50) {
                            $(this).addClass("move");
                        }
                    });
                }
            });
    
            $('a[href^="#"]').on('click', function (event) {
                var target = $(this.getAttribute('href'));
                if (target.length) {
                    event.preventDefault();
                    $('html, body').stop().animate({
                        scrollTop: target.offset().top
                    }, 1000);
                }
            });
        });
    
        let divHeight = 0;
        $(".service .box")
            .find("div")
            .each(function () {
                if ($(this).innerHeight() > divHeight) {
                    divHeight = $(this).innerHeight();
                }
            });
        $(".service .box").find("div").css("min-height", divHeight);
        $(window).on("resize", function () {
            let divHeight = 0;
            $(".service .box")
                .find("div")
                .each(function () {
                    if ($(this).innerHeight() > divHeight) {
                        divHeight = $(this).innerHeight();
                    }
                });
            $(".service .box").find("div").css("min-height", divHeight);
        });
    
        $(".accOpen").hide();
        $(".accBtn").on("click", function () {
            $(this).next(".accOpen").fadeToggle();
        });
        $(".accBtn").click(function () {
            $(this).toggleClass("arrow");
        });
    
        if ($("#check").prop("checked") == false) {
            $(".submit_c").attr("disabled", "disabled");
        }
        $("#check").on("click", function () {
            if ($(this).prop("checked") == false) {
                $(".submit_c").attr("disabled", "disabled");
            } else {
                $(".submit_c").removeAttr("disabled");
            }
        });
        if ($("section > form > .submit").length) {
            const SUBMIT = $("section > form").find(".submit");
            SUBMIT.insertAfter($("section > form"));
        }
    
    
    
    
        if (window.matchMedia("(max-width: 640px)").matches) {
            $("#recruit-link").html("Recruit");
        }
    
        /* !aの取得、順番替え-----------------------------------------------------*/
        $(".s-service__menu .box article").each(function () {
            var href = $(this).find("a").attr("href");
            var target = $(this).find("a").attr("target");
            $(this).find("a").contents().unwrap();
            $(this).wrap('<a href="' + href + '" target="' + target + '"/>');
        });
    
        /* !header固定-----------------------------------------------------*/
        // var target = $(".header");
        // var startPos = 0,
        //   winScrollTop = 0;
        // $(window).on("scroll", function () {
        //   winScrollTop = $(this).scrollTop();
        //   if (winScrollTop >= startPos) {
        //     if (winScrollTop >= 100) {
        //       target.addClass("hide");
        //     }
        //   } else {
        //     target.removeClass("hide");
        //   }
        //   startPos = winScrollTop;
        // });
        // $(window).scroll(function () {
        //   if ($(this).scrollTop() > 100) {
        //     target.addClass("view");
        //   } else {
        //     target.removeClass("view");
        //   }
        // });
    
        /* !dropdownmenu ------------------------------------------------------------ */
        if (window.matchMedia("(min-width: 641px)").matches) {
            $(".nav ul li ul").hide();
            $(".nav ul li").hover(
                function () {
                    $("ul:not(:animated)", this).fadeIn();
                },
                function () {
                    $("ul", this).fadeOut();
                }
            );
        }
    
        /* !fancyBox ---------------------------------------------------------------- */
        // $(".fancybox").each(function (i) {
        //     $(this)
        //         .find("a")
        //         .attr({
        //             "data-fancybox": "group" + i,
        //             "data-type": "image",
        //         });
        // });
        // $(".fancybox a").fancybox({
        //     animationEffect: "fade",
        //     transitionIn: "fade", //'elastic', 'fade' or 'none'
        //     transitionOut: "fade", //'elastic', 'fade' or 'none'
        //     centerOnScroll: true,
        //     transitionEffect: "fade",
        //     animationEffect: "fade",
        // });
    
        // $(".fancybox2").fancybox({
        //     titlePosition: "inside",
        //     transitionIn: "none",
        //     transitionOut: "none",
        // });
    
        /* !SP ---------------------------------------------------------------- */
        $("a img").bind("touchstart", function () {
            $(this).attr("src", $(this).attr("src").replace("_off", "_on"));
        });
        $("a img").bind("touchend", function () {
            $(this).attr("src", $(this).attr("src").replace("_on", "_off"));
        });
    
        /* !niceScroll ---------------------------------------------------------------- */
        // $(document).ready(function () {
        //     if ($(window).width() >= 1280) {
        //         $("body").niceScroll();
        //     }
        // });
        /* ##### END JQUERY ################################################ */
    });
    
    