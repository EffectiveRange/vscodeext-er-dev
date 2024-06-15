project(proj1)

include(GNUInstallDirs)

add_executable(proj1 main.cpp)

add_executable(proj1_2 main2.cpp)

install(TARGETS proj1 proj1_2)

# Set CPack variables for Debian packaging
set(CPACK_GENERATOR "DEB")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Test Joe") # replace with your name
set(CPACK_DEBIAN_PACKAGE_NAME "proj1")
set(CPACK_DEBIAN_FILE_NAME DEB-DEFAULT)
set(CPACK_DEBIAN_PACKAGE_VERSION "1.0.0") # replace with your version
set(CPACK_DEBIAN_PACKAGE_SECTION "utils")
set(CPACK_DEBIAN_PACKAGE_PRIORITY "optional")
set(CPACK_DEBIAN_PACKAGE_DEPENDS "libc6 (>= 2.3.1-6), libgcc1 (>= 1:3.4.2-12), libstdc++6")
set(CPACK_DEBIAN_PACKAGE_DESCRIPTION "Test project 1") # replace with your description

# Include CPack
include(CPack)