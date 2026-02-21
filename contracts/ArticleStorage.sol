// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// قرارداد هوشمند جهت مدیریت اصالت و یکپارچگی منابع آموزشی
contract ArticleStorage {
    // IPFS تعریف ساختار داده برای نگاشت شناسه مقاله به آدرس
    mapping(uint256 => string) private articleLinks;
    uint256 public totalRecords;

    // P2P رویداد جهت انتشار خبر ثبت مقاله در سراسر شبکه
    event RecordFinalized(uint256 indexed id, string ipfsAddress);

    /**
     * @dev IPFS تابع ثبت پیوند میان مقاله و هویت دیجیتال آن در
     * این تابع پس از تایید اصالت در لایه مدل زبانی فراخوانی می‌شود.
     */
    function storeIntegrityLink(uint256 _articleId, string memory _cid) public {
        // شرط عدم وجود سابقه قبلی برای جلوگیری از جعل مالکیت
        require(bytes(articleLinks[_articleId]).length == 0, "Error: Proof already exists!");
        // شرط معتبر بودن آدرس فایل
        require(bytes(_cid).length > 0, "Error: Invalid CID!");

        // ثبت نهایی در لایه ذخیره‌سازی بلاک‌چین (تغییر ناپذیر)
        articleLinks[_articleId] = _cid;
        totalRecords++;

        // صدور رویداد جهت ثبت در تاریخچه بلوک‌ها
        emit RecordFinalized(_articleId, _cid);
    }

    /**
     * @dev تابع استعلام و بازخوانی پیوند جهت داوری در شبکه
     */
    function verifyIntegrity(uint256 _articleId) external view returns (string memory) {
        return articleLinks[_articleId];
    }
}