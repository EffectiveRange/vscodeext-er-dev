project(proj2)

include(GNUInstallDirs)

add_library(project SHARED library.cpp)

target_include_directories(project PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

add_executable(proj2 main.cpp)

target_link_libraries(proj2 project)

install(TARGETS project proj2)


# Set CPack variables for Debian packaging
set(CPACK_GENERATOR "DEB")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Test Joe") # replace with your name
set(CPACK_DEBIAN_PACKAGE_NAME "proj2")
set(CPACK_DEBIAN_FILE_NAME DEB-DEFAULT)
set(CPACK_DEBIAN_PACKAGE_VERSION "1.0.0") # replace with your version
set(CPACK_DEBIAN_PACKAGE_SECTION "utils")
set(CPACK_DEBIAN_PACKAGE_PRIORITY "optional")
set(CPACK_DEBIAN_PACKAGE_DEPENDS "libc6 (>= 2.3.1-6), libgcc1 (>= 1:3.4.2-12), libstdc++6")
set(CPACK_DEBIAN_PACKAGE_DESCRIPTION "Test project 2") # replace with your description

# Include CPack
include(CPack)